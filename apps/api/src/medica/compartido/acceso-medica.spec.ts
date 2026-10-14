/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { PrismaService } from '../../prisma/prisma.service';
import { AgendaMedicaController } from '../agenda/agenda-medica.controller';
import { AtencionesMedicasController } from '../atenciones/atenciones-medicas.controller';
import { BandejaMedicaController } from '../bandeja/bandeja-medica.controller';
import { CitasMedicasController } from '../citas/citas-medicas.controller';
import { ConsultasMedicasController } from '../consultas/consultas-medicas.controller';
import { DocumentosMedicosController } from '../documentos/documentos-medicos.controller';
import type { IAccesoMedicaRepository } from '../interfaces/acceso-medica-repository.interface';
import { PacientesMedicaController } from '../pacientes/pacientes-medica.controller';
import { ReportesMedicaController } from '../reportes/reportes-medica.controller';
import {
  AccesoMedicaRepository,
  EXPEDIENTE_REFERIDO_A_MEDICA,
} from '../repositories/acceso-medica.repository';
import { AccesoMedicaService } from './acceso-medica.service';

// Los controladores arrastran servicios con Redis/configuración; aquí solo importan sus decoradores.
jest.mock('../../redis/redis.service', () => ({ RedisService: class {} }));

// La autorización es la superficie más delicada del módulo: un fallo aquí expone el expediente
// clínico de una sobreviviente a quien no debe verlo.

describe('AccesoMedicaService', () => {
  let repository: jest.Mocked<IAccesoMedicaRepository>;
  let service: AccesoMedicaService;

  beforeEach(() => {
    repository = {
      buscarExpediente: jest.fn().mockResolvedValue(null),
      buscarReferencia: jest.fn().mockResolvedValue(null),
      buscarAtencion: jest.fn().mockResolvedValue(null),
      buscarCita: jest.fn().mockResolvedValue(null),
      buscarConsulta: jest.fn().mockResolvedValue(null),
      buscarDocumento: jest.fn().mockResolvedValue(null),
      usuariaReferida: jest.fn().mockResolvedValue(false),
      ninoPerteneceAExpediente: jest.fn().mockResolvedValue(false),
    };
    service = new AccesoMedicaService(repository);
  });

  it.each([
    ['exigirExpediente'],
    ['exigirReferencia'],
    ['exigirAtencion'],
    ['exigirCita'],
    ['exigirConsulta'],
    ['exigirDocumento'],
    ['exigirUsuaria'],
  ] as const)(
    '%s responde 403 si el recurso no existe o no es de Medicina',
    async (metodo) => {
      await expect(service[metodo]('id-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );

  it('devuelve el recurso cuando el repositorio lo encuentra', async () => {
    const acceso = {
      expedienteId: 'exp-1',
      expedienteNumero: '2026-0001',
      usuariaId: 'u-1',
    };
    repository.buscarExpediente.mockResolvedValue(acceso);
    await expect(service.exigirExpediente('exp-1')).resolves.toBe(acceso);
  });

  it('la usuaria siempre es persona del expediente; un hijo/a solo si es de ese expediente', async () => {
    await expect(service.personaDelExpediente(null, 'exp-1')).resolves.toBe(
      true,
    );
    await expect(service.personaDelExpediente('n-1', 'exp-1')).resolves.toBe(
      false,
    );
    expect(repository.ninoPerteneceAExpediente).toHaveBeenCalledWith(
      'n-1',
      'exp-1',
    );
  });
});

describe('AccesoMedicaRepository: cada búsqueda exige la referencia a Medicina', () => {
  const findFirst = () => jest.fn().mockResolvedValue(null);
  const prisma = {
    expediente: { findFirst: findFirst() },
    referidoArea: { findFirst: findFirst() },
    atencionMedica: { findFirst: findFirst() },
    citaMedica: { findFirst: findFirst() },
    consultaMedica: { findFirst: findFirst() },
    documentoMedico: { findFirst: findFirst() },
    nino: { findFirst: findFirst() },
  };
  const repository = new AccesoMedicaRepository(
    prisma as unknown as PrismaService,
  );
  const where = (mock: jest.Mock): unknown =>
    ((mock.mock.calls as unknown[][]).at(-1)?.[0] as { where: unknown }).where;

  it('la condición es tener una referencia de Trabajo Social a MEDICA', () => {
    expect(EXPEDIENTE_REFERIDO_A_MEDICA).toEqual({
      referidos: { some: { area: 'MEDICA' } },
    });
  });

  it('expediente y usuaria', async () => {
    await repository.buscarExpediente('exp-1');
    expect(where(prisma.expediente.findFirst)).toEqual({
      id: 'exp-1',
      ...EXPEDIENTE_REFERIDO_A_MEDICA,
    });
    await repository.usuariaReferida('u-1');
    expect(where(prisma.expediente.findFirst)).toEqual({
      usuariaId: 'u-1',
      ...EXPEDIENTE_REFERIDO_A_MEDICA,
    });
  });

  it('referencia: solo las dirigidas a MEDICA', async () => {
    await repository.buscarReferencia('r-1');
    expect(where(prisma.referidoArea.findFirst)).toEqual({
      id: 'r-1',
      area: 'MEDICA',
    });
  });

  it('atención, cita, consulta y documento suben hasta el expediente referido', async () => {
    await repository.buscarAtencion('a-1');
    expect(where(prisma.atencionMedica.findFirst)).toEqual({
      id: 'a-1',
      expediente: EXPEDIENTE_REFERIDO_A_MEDICA,
    });
    await repository.buscarCita('c-1');
    expect(where(prisma.citaMedica.findFirst)).toEqual({
      id: 'c-1',
      atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
    });
    await repository.buscarConsulta('k-1');
    expect(where(prisma.consultaMedica.findFirst)).toEqual({
      id: 'k-1',
      atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA },
    });
    await repository.buscarDocumento('d-1');
    expect(where(prisma.documentoMedico.findFirst)).toEqual({
      id: 'd-1',
      consulta: { atencion: { expediente: EXPEDIENTE_REFERIDO_A_MEDICA } },
    });
  });

  it('un hijo/a se busca dentro del expediente indicado', async () => {
    await repository.ninoPerteneceAExpediente('n-1', 'exp-1');
    expect(where(prisma.nino.findFirst)).toEqual({
      id: 'n-1',
      expedienteId: 'exp-1',
    });
  });
});

describe('controladores de Medicina', () => {
  const controladores: Type<unknown>[] = [
    BandejaMedicaController,
    AgendaMedicaController,
    CitasMedicasController,
    ConsultasMedicasController,
    DocumentosMedicosController,
    AtencionesMedicasController,
    PacientesMedicaController,
    ReportesMedicaController,
  ];

  it.each(controladores.map((c) => [c.name, c]))(
    '%s exige el rol MEDICA con RolesGuard',
    (_nombre, controlador) => {
      expect(Reflect.getMetadata(ROLES_KEY, controlador)).toEqual(['MEDICA']);
      expect(Reflect.getMetadata(GUARDS_METADATA, controlador)).toContain(
        RolesGuard,
      );
    },
  );
});
