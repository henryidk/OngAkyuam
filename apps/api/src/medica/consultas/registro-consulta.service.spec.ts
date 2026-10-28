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
  PersonasVisitaIncompletaError,
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
  personas: [null],
  inicio: new Date('2026-10-14T14:30:00.000Z'),
  duracionMin: 30,
  estadoCita: 'PROGRAMADA',
  versionCita: 1,
  personasRegistradas: [],
  reprogramadaAId: null,
};
function registro(ninoId: string | null, extra: object = {}) {
  return {
    ninoId,
    motivoConsulta: 'Dolor de cabeza',
    signos: {},
    diagnostico: 'Cefalea tensional',
    planTratamiento: null,
    recetaLaboratorios: null,
    loteDocumentos: null,
    ...extra,
  };
}
const DATOS = {
  atencionId: 'a-1',
  citaId: 'c-1',
  registros: [registro(null)],
  proxima: null,
};
const CITA_FAMILIAR: AccesoCitaMedica = {
  ...CITA,
  personas: [null, 'nino-1', 'nino-2'],
  duracionMin: 60,
};
const VISITA_FAMILIAR = {
  ...DATOS,
  registros: [registro(null), registro('nino-1'), registro('nino-2')],
};

function creada(consultaId: string, ninoId: string | null, documentos = 0) {
  return {
    consultaId,
    ninoId,
    personaNombre: `Persona ${consultaId}`,
    documentosAsociados: documentos,
  };
}

describe('RegistroConsultaService', () => {
  let repository: jest.Mocked<IConsultasMedicasRepository>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let redis: { get: jest.Mock; set: jest.Mock };
  let audit: jest.Mocked<AuditService>;
  let service: RegistroConsultaService;

  beforeEach(() => {
    repository = {
      registrar: jest.fn().mockResolvedValue({
        consultas: [creada('k-1', null)],
        proximaCitaId: null,
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
      usuariaId: 'u-1',
      consultas: [
        { consultaId: 'k-1', ninoId: null, personaNombre: 'Persona k-1' },
      ],
      proximaCita: null,
    });
    expect(repository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        citaId: 'c-1',
        fechaHora: CITA.inicio,
        registradaPorId: 'medica-1',
        registros: DATOS.registros,
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
      expect.objectContaining({
        citaId: null,
        fechaHora: AHORA,
      }),
    );
  });

  it('una segunda consulta para la misma cita responde 409', async () => {
    acceso.exigirCita.mockResolvedValue({
      ...CITA,
      estadoCita: 'ATENDIDA',
      personasRegistradas: [null],
    });
    await expect(
      service.registrar(DATOS as never, CONTEXTO),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.registrar).not.toHaveBeenCalled();
  });

  describe('visita familiar', () => {
    beforeEach(() => {
      acceso.exigirCita.mockResolvedValue(CITA_FAMILIAR);
      repository.registrar.mockResolvedValue({
        consultas: [
          creada('k-1', null),
          creada('k-2', 'nino-1', 2),
          creada('k-3', 'nino-2'),
        ],
        proximaCitaId: null,
      });
    });

    it('registra a todas las personas de una vez y audita una consulta por persona', async () => {
      const respuesta = await service.registrar(
        VISITA_FAMILIAR as never,
        CONTEXTO,
      );
      expect(respuesta.consultas.map((c) => c.ninoId)).toEqual([
        null,
        'nino-1',
        'nino-2',
      ]);
      expect(repository.registrar).toHaveBeenCalledTimes(1);
      expect(repository.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          registros: VISITA_FAMILIAR.registros,
        }),
      );
      const auditadas = audit.registrar.mock.calls.map(([e]) => [
        e.accion,
        e.entidadId,
        (e.detalles as { documentos: number }).documentos,
      ]);
      expect(auditadas).toEqual([
        ['CONSULTA_MEDICA_REGISTRADA', 'k-1', 0],
        ['CONSULTA_MEDICA_REGISTRADA', 'k-2', 2],
        ['CONSULTA_MEDICA_REGISTRADA', 'k-3', 0],
      ]);
    });

    it('si falta una persona de la cita responde 400 y no guarda nada', async () => {
      await expect(
        service.registrar(
          {
            ...DATOS,
            registros: [registro(null), registro('nino-1')],
          } as never,
          CONTEXTO,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.registrar).not.toHaveBeenCalled();
    });

    it('una persona que no está en la cita responde 400', async () => {
      await expect(
        service.registrar(
          {
            ...DATOS,
            registros: [...VISITA_FAMILIAR.registros, registro('nino-3')],
          } as never,
          CONTEXTO,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.registrar).not.toHaveBeenCalled();
    });

    it('una persona ya registrada responde 409', async () => {
      acceso.exigirCita.mockResolvedValue({
        ...CITA_FAMILIAR,
        personasRegistradas: [null],
      });
      await expect(
        service.registrar(VISITA_FAMILIAR as never, CONTEXTO),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.registrar).not.toHaveBeenCalled();
    });

    it('con personas ya registradas (datos anteriores), basta con las que faltan', async () => {
      acceso.exigirCita.mockResolvedValue({
        ...CITA_FAMILIAR,
        personasRegistradas: [null],
      });
      await service.registrar(
        {
          ...DATOS,
          registros: [registro('nino-1'), registro('nino-2')],
        } as never,
        CONTEXTO,
      );
      expect(repository.registrar).toHaveBeenCalledTimes(1);
    });

    it('si la transacción detecta la visita incompleta, 400 sin auditar', async () => {
      repository.registrar.mockRejectedValue(
        new PersonasVisitaIncompletaError(),
      );
      await expect(
        service.registrar(VISITA_FAMILIAR as never, CONTEXTO),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it('la próxima cita lleva la duración y las personas que eligió la médica', async () => {
      repository.registrar.mockResolvedValue({
        consultas: [
          creada('k-1', null),
          creada('k-2', 'nino-1'),
          creada('k-3', 'nino-2'),
        ],
        proximaCitaId: 'c-2',
      });
      await service.registrar(
        {
          ...VISITA_FAMILIAR,
          proxima: {
            inicio: '2026-10-21T10:00',
            duracionMin: 90,
            personas: ['nino-1'],
          },
        } as never,
        CONTEXTO,
      );
      expect(repository.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          proxima: {
            inicio: new Date('2026-10-21T16:00:00.000Z'),
            duracionMin: 90,
            personas: ['nino-1'],
          },
        }),
      );
      expect(audit.registrar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          accion: 'CITA_MEDICA_PROGRAMADA',
          entidadId: 'c-2',
          detalles: expect.objectContaining({
            consultaIds: ['k-1', 'k-2', 'k-3'],
            personas: 1,
            duracionMin: 90,
          }) as unknown,
        }),
      );
    });

    it('una próxima que no cabe con su duración responde 400', async () => {
      await expect(
        service.registrar(
          {
            ...VISITA_FAMILIAR,
            proxima: {
              inicio: '2026-10-21T16:30',
              duracionMin: 60,
              personas: [null],
            },
          } as never,
          CONTEXTO,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.registrar).not.toHaveBeenCalled();
    });
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

  it('sin cita, un niño de otro expediente responde 400', async () => {
    acceso.personaDelExpediente.mockImplementation((ninoId) =>
      Promise.resolve(ninoId !== 'nino-ajeno'),
    );
    await expect(
      service.registrar(
        {
          ...DATOS,
          citaId: null,
          registros: [registro(null), registro('nino-ajeno')],
        } as never,
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
      consultas: [creada('k-1', null)],
      proximaCitaId: 'c-2',
    });
    const respuesta = await service.registrar(
      {
        ...DATOS,
        proxima: {
          inicio: '2026-10-21T08:30',
          duracionMin: 30,
          personas: [null],
        },
      } as never,
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
        {
          ...DATOS,
          proxima: {
            inicio: '2026-10-21T19:00',
            duracionMin: 30,
            personas: [null],
          },
        } as never,
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.registrar).not.toHaveBeenCalled();
  });

  it('un lote vencido responde 400', async () => {
    repository.registrar.mockRejectedValue(new LoteVencidoError());
    await expect(
      service.registrar(
        {
          ...DATOS,
          registros: [registro(null, { loteDocumentos: 'lote-1' })],
        } as never,
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('la misma Idempotency-Key no registra dos veces', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ usuariaId: 'u-1' }));
    await expect(
      service.registrar(DATOS as never, CONTEXTO, 'clave-12345678'),
    ).resolves.toEqual({ usuariaId: 'u-1' });
    expect(repository.registrar).not.toHaveBeenCalled();
  });
});
