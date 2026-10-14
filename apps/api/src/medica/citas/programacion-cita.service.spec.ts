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
import { CODIGO_HORARIO_OCUPADO } from '../compartido/errores-http';
import { IdempotenciaMedica } from '../compartido/idempotencia';
import { HorarioOcupadoError } from '../interfaces/errores-medica';
import type { ICitasMedicasRepository } from '../interfaces/citas-medicas-repository.interface';
import { ProgramacionCitaService } from './programacion-cita.service';

// El RedisService real arrastra @nestjs/config (ESM); aquí basta con un get/set falso.
jest.mock('../../redis/redis.service', () => ({ RedisService: class {} }));
const CONTEXTO = { usuarioId: 'medica-1' } as ContextoAuditoria;
// Miércoles 14/10/2026, 09:00 en Guatemala.
const AHORA = new Date('2026-10-14T15:00:00.000Z');
// Jueves 15/10/2026, 09:00 en Guatemala: día hábil y hora del horario.
const INICIO = '2026-10-15T09:00';
const EXPEDIENTE = {
  expedienteId: 'exp-1',
  expedienteNumero: '2026-0001',
  usuariaId: 'u-1',
};

describe('ProgramacionCitaService', () => {
  let repository: jest.Mocked<ICitasMedicasRepository>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let redis: { get: jest.Mock; set: jest.Mock };
  let audit: jest.Mocked<AuditService>;
  let service: ProgramacionCitaService;

  beforeEach(() => {
    repository = {
      programar: jest.fn().mockResolvedValue({
        citaId: 'c-1',
        atencionId: 'a-1',
        consecutivo: 1,
        atencionAbierta: true,
      }),
    } as unknown as jest.Mocked<ICitasMedicasRepository>;
    acceso = {
      exigirReferencia: jest
        .fn()
        .mockResolvedValue({ ...EXPEDIENTE, referidoId: 'r-1' }),
      exigirExpediente: jest.fn().mockResolvedValue(EXPEDIENTE),
      personaDelExpediente: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<AccesoMedicaService>;
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    audit = { registrar: jest.fn() } as unknown as jest.Mocked<AuditService>;
    service = new ProgramacionCitaService(
      repository,
      { ahora: () => AHORA },
      acceso,
      new IdempotenciaMedica(redis as unknown as RedisService),
      audit,
    );
  });

  it('desde una referencia abre la atención y audita apertura y cita', async () => {
    const respuesta = await service.programar(
      { referidoId: 'r-1', ninoId: null, inicio: INICIO },
      CONTEXTO,
    );
    expect(respuesta).toEqual({
      citaId: 'c-1',
      atencionId: 'a-1',
      codigoAtencion: 'M1-2026-0001',
      atencionAbierta: true,
      fecha: '2026-10-15',
      hora: '09:00',
    });
    expect(repository.programar).toHaveBeenCalledWith(
      expect.objectContaining({
        expedienteId: 'exp-1',
        referidoId: 'r-1',
        hoy: '2026-10-14',
        creadoPorId: 'medica-1',
      }),
    );
    const acciones = audit.registrar.mock.calls.map(
      ([evento]) => evento.accion,
    );
    expect(acciones).toEqual([
      'ATENCION_MEDICA_ABIERTA',
      'CITA_MEDICA_PROGRAMADA',
    ]);
  });

  it('sin acceso a la referencia no programa nada', async () => {
    acceso.exigirReferencia.mockRejectedValue(new ForbiddenException());
    await expect(
      service.programar(
        { referidoId: 'r-1', ninoId: null, inicio: INICIO },
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.programar).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('un niño de otro expediente responde 400', async () => {
    acceso.personaDelExpediente.mockResolvedValue(false);
    await expect(
      service.programar(
        {
          expedienteId: 'exp-1',
          ninoId: 'nino-ajeno',
          inicio: INICIO,
        },
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(acceso.personaDelExpediente).toHaveBeenCalledWith(
      'nino-ajeno',
      'exp-1',
    );
    expect(repository.programar).not.toHaveBeenCalled();
  });

  it.each([
    ['en el pasado', '2026-10-13T09:00'],
    ['fuera del horario', '2026-10-15T13:00'],
    ['en fin de semana', '2026-10-17T09:00'],
  ])('un inicio %s responde 400', async (_caso, inicio) => {
    await expect(
      service.programar(
        { expedienteId: 'exp-1', ninoId: null, inicio },
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.programar).not.toHaveBeenCalled();
  });

  it('horario ocupado responde 409 con su código y no audita', async () => {
    repository.programar.mockRejectedValue(new HorarioOcupadoError());
    const error = await service
      .programar(
        { expedienteId: 'exp-1', ninoId: null, inicio: INICIO },
        CONTEXTO,
      )
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual(
      expect.objectContaining({ codigo: CODIGO_HORARIO_OCUPADO }),
    );
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('con atención ya activa solo audita la cita', async () => {
    repository.programar.mockResolvedValue({
      citaId: 'c-2',
      atencionId: 'a-1',
      consecutivo: 1,
      atencionAbierta: false,
    });
    await service.programar(
      { expedienteId: 'exp-1', ninoId: null, inicio: INICIO },
      CONTEXTO,
    );
    expect(audit.registrar).toHaveBeenCalledTimes(1);
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'CITA_MEDICA_PROGRAMADA' }),
    );
  });

  describe('idempotencia', () => {
    it('la misma clave devuelve la primera respuesta sin crear otra cita', async () => {
      const primera = { citaId: 'c-1', atencionAbierta: true };
      redis.get.mockResolvedValue(JSON.stringify(primera));
      await expect(
        service.programar(
          { expedienteId: 'exp-1', ninoId: null, inicio: INICIO },
          CONTEXTO,
          'clave-12345678',
        ),
      ).resolves.toEqual(primera);
      expect(redis.get).toHaveBeenCalledWith(
        'medica:programar:medica-1:clave-12345678',
      );
      expect(repository.programar).not.toHaveBeenCalled();
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('la primera vez guarda la respuesta bajo la clave', async () => {
      const respuesta = await service.programar(
        { expedienteId: 'exp-1', ninoId: null, inicio: INICIO },
        CONTEXTO,
        'clave-12345678',
      );
      expect(redis.set).toHaveBeenCalledWith(
        'medica:programar:medica-1:clave-12345678',
        JSON.stringify(respuesta),
        expect.any(Number),
      );
    });

    it('una clave con formato inválido responde 400', async () => {
      await expect(
        service.programar(
          { expedienteId: 'exp-1', ninoId: null, inicio: INICIO },
          CONTEXTO,
          'x',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.programar).not.toHaveBeenCalled();
    });
  });
});
