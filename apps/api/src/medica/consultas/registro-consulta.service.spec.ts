/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { RedisService } from '../../redis/redis.service';
import type { AccesoMedicaService } from '../compartido/acceso-medica.service';
import { IdempotenciaMedica } from '../compartido/idempotencia';
import type {
  AccesoAtencionMedica,
  AccesoCitaMedica,
} from '../interfaces/acceso-medica-repository.interface';
import type { IConsultasMedicasRepository } from '../interfaces/consultas-medicas-repository.interface';
import {
  CitaNoDisponibleError,
  LoteVencidoError,
} from '../interfaces/errores-medica';
import { RegistroConsultaService } from './registro-consulta.service';

// El RedisService real arrastra @nestjs/config (ESM); aquí basta con un get/set falso.
jest.mock('../../redis/redis.service', () => ({ RedisService: class {} }));
const CONTEXTO = { usuarioId: 'medica-1' } as ContextoAuditoria;
// Miércoles 14/10/2026, 09:00 en Guatemala.
const AHORA = new Date('2026-10-14T15:00:00.000Z');
const ATENCION: AccesoAtencionMedica = {
  atencionId: 'a-1',
  expedienteId: 'exp-1',
  expedienteNumero: '2026-0001',
  usuariaId: 'u-1',
  consecutivo: 1,
  estado: 'ACTIVA',
  version: 1,
};
const CITA: AccesoCitaMedica = {
  ...ATENCION,
  citaId: 'c-1',
  ninoId: null,
  inicio: new Date('2026-10-14T14:30:00.000Z'),
  duracionMin: 30,
  estadoCita: 'PROGRAMADA',
  versionCita: 1,
  consultaId: null,
  reprogramadaAId: null,
};
const DATOS = {
  atencionId: 'a-1',
  citaId: 'c-1',
  ninoId: null,
  motivoConsulta: 'Dolor de cabeza',
  signos: {},
  diagnostico: 'Cefalea tensional',
  planTratamiento: null,
  recetaLaboratorios: null,
  proxima: null,
  loteDocumentos: null,
};

describe('RegistroConsultaService', () => {
  let repository: jest.Mocked<IConsultasMedicasRepository>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let redis: { get: jest.Mock; set: jest.Mock };
  let audit: jest.Mocked<AuditService>;
  let service: RegistroConsultaService;

  beforeEach(() => {
    repository = {
      registrar: jest.fn().mockResolvedValue({
        consultaId: 'k-1',
        personaNombre: 'Persona de prueba',
        proximaCitaId: null,
        documentosAsociados: 0,
      }),
    } as unknown as jest.Mocked<IConsultasMedicasRepository>;
    acceso = {
      exigirAtencion: jest.fn().mockResolvedValue(ATENCION),
      exigirCita: jest.fn().mockResolvedValue(CITA),
      personaDelExpediente: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AccesoMedicaService>;
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    audit = { registrar: jest.fn() } as unknown as jest.Mocked<AuditService>;
    service = new RegistroConsultaService(
      repository,
      { ahora: () => AHORA },
      acceso,
      new IdempotenciaMedica(redis as unknown as RedisService),
      audit,
    );
  });

  it('desde una cita, la consulta toma la hora de la cita', async () => {
    await expect(service.registrar(DATOS as never, CONTEXTO)).resolves.toEqual({
      consultaId: 'k-1',
      usuariaId: 'u-1',
      personaNombre: 'Persona de prueba',
      proximaCita: null,
    });
    expect(repository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        citaId: 'c-1',
        fechaHora: CITA.inicio,
        registradaPorId: 'medica-1',
      }),
    );
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'CONSULTA_MEDICA_REGISTRADA',
        entidadId: 'k-1',
      }),
    );
  });

  it('sin cita, la consulta queda con la hora actual', async () => {
    await service.registrar({ ...DATOS, citaId: null } as never, CONTEXTO);
    expect(acceso.exigirCita).not.toHaveBeenCalled();
    expect(repository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ citaId: null, fechaHora: AHORA }),
    );
  });

  it('una segunda consulta para la misma cita responde 409', async () => {
    acceso.exigirCita.mockResolvedValue({
      ...CITA,
      estadoCita: 'ATENDIDA',
      consultaId: 'k-0',
    });
    await expect(
      service.registrar(DATOS as never, CONTEXTO),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.registrar).not.toHaveBeenCalled();
  });

  it('si otra pestaña la registró antes (carrera en la transacción), 409', async () => {
    repository.registrar.mockRejectedValue(new CitaNoDisponibleError());
    await expect(
      service.registrar(DATOS as never, CONTEXTO),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('una cita de otra atención responde 403', async () => {
    acceso.exigirCita.mockResolvedValue({ ...CITA, atencionId: 'a-otra' });
    await expect(
      service.registrar(DATOS as never, CONTEXTO),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.registrar).not.toHaveBeenCalled();
  });

  it('una persona distinta a la de la cita responde 400', async () => {
    await expect(
      service.registrar({ ...DATOS, ninoId: 'nino-1' } as never, CONTEXTO),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.registrar).not.toHaveBeenCalled();
  });

  it('sin cita, un niño de otro expediente responde 400', async () => {
    acceso.personaDelExpediente.mockResolvedValue(false);
    await expect(
      service.registrar(
        { ...DATOS, citaId: null, ninoId: 'nino-ajeno' } as never,
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.registrar).not.toHaveBeenCalled();
  });

  it('una atención con alta responde 409', async () => {
    acceso.exigirAtencion.mockResolvedValue({ ...ATENCION, estado: 'ALTA' });
    await expect(
      service.registrar(DATOS as never, CONTEXTO),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.registrar).not.toHaveBeenCalled();
  });

  it('con próxima consulta programa la cita y la audita', async () => {
    repository.registrar.mockResolvedValue({
      consultaId: 'k-1',
      personaNombre: 'Persona de prueba',
      proximaCitaId: 'c-2',
      documentosAsociados: 0,
    });
    const respuesta = await service.registrar(
      { ...DATOS, proxima: '2026-10-21T08:30' } as never,
      CONTEXTO,
    );
    expect(respuesta.proximaCita).toEqual({
      citaId: 'c-2',
      atencionId: 'a-1',
      codigoAtencion: '2026-0001',
      atencionAbierta: false,
      fecha: '2026-10-21',
      hora: '08:30',
    });
    const acciones = audit.registrar.mock.calls.map(([e]) => e.accion);
    expect(acciones).toEqual([
      'CONSULTA_MEDICA_REGISTRADA',
      'CITA_MEDICA_PROGRAMADA',
    ]);
  });

  it('una próxima consulta fuera del horario responde 400 antes de guardar', async () => {
    await expect(
      service.registrar(
        { ...DATOS, proxima: '2026-10-21T19:00' } as never,
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.registrar).not.toHaveBeenCalled();
  });

  it('asocia los documentos pendientes del lote y lo deja en la auditoría', async () => {
    repository.registrar.mockResolvedValue({
      consultaId: 'k-1',
      personaNombre: 'Persona de prueba',
      proximaCitaId: null,
      documentosAsociados: 2,
    });
    await service.registrar(
      { ...DATOS, loteDocumentos: 'lote-1' } as never,
      CONTEXTO,
    );
    expect(repository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ loteDocumentos: 'lote-1' }),
    );
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        detalles: expect.objectContaining({ documentos: 2 }) as unknown,
      }),
    );
  });

  it('un lote vencido responde 400', async () => {
    repository.registrar.mockRejectedValue(new LoteVencidoError());
    await expect(
      service.registrar(
        { ...DATOS, loteDocumentos: 'lote-1' } as never,
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la misma Idempotency-Key no registra dos consultas', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ consultaId: 'k-1' }));
    await expect(
      service.registrar(DATOS as never, CONTEXTO, 'clave-12345678'),
    ).resolves.toEqual({ consultaId: 'k-1' });
    expect(repository.registrar).not.toHaveBeenCalled();
  });
});
