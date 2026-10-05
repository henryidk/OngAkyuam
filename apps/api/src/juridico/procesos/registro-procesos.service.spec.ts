/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { CrearProcesosEnLoteInput } from '@akyuam/shared';
import type { AsignacionPersonalService } from '../compartido/asignacion-personal.service';
import {
  MENSAJE_REFERENCIA_NO_PENDIENTE,
  MENSAJE_SIN_ACCESO_EXPEDIENTE,
  MENSAJE_SIN_ACCESO_REFERENCIA,
} from '../compartido/mensajes';
import type { IReferenciasRepository } from '../interfaces/referencias-repository.interface';
import {
  ReferenciaNoPendienteError,
  type IRegistroProcesosRepository,
} from '../interfaces/registro-procesos-repository.interface';
import type { IUsuariasJuridicoRepository } from '../interfaces/usuarias-repository.interface';
import {
  EXPEDIENTE_ID,
  PROCESO_ID,
  REFERIDO_ID,
  USUARIA_ID,
  accionesAuditadas,
  contexto,
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
  crearRedis,
  expedienteConAcceso,
} from '../pruebas/dobles';
import { RegistroProcesosService } from './registro-procesos.service';

// RedisService importa @nestjs/config (ESM puro), que Jest no carga: aquí solo se usa su tipo.
jest.mock('../../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

const OTRO_ID = '99999999-9999-4999-8999-999999999999';

function lote(
  parcial: Partial<CrearProcesosEnLoteInput> = {},
): CrearProcesosEnLoteInput {
  return {
    referidoId: REFERIDO_ID,
    confirmaDuplicados: false,
    procesos: [
      {
        tipo: 'MEDIDAS_SEGURIDAD',
        abogadaId: '',
        procuradoraId: '',
        fechaInicio: '2026-01-10',
        procesoOrigenId: null,
      },
    ],
    ...parcial,
  };
}

describe('RegistroProcesosService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let registroRepository: jest.Mocked<IRegistroProcesosRepository>;
  let asignacion: jest.Mocked<Pick<AsignacionPersonalService, 'validar'>>;
  let auditService: ReturnType<typeof crearAuditService>;
  let redis: ReturnType<typeof crearRedis>;
  let service: RegistroProcesosService;

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    registroRepository = {
      buscarActivosPorTipo: jest.fn().mockResolvedValue([]),
      listarVinculables: jest.fn().mockResolvedValue([]),
      crearLote: jest
        .fn()
        .mockResolvedValue([{ id: PROCESO_ID, codigo: 'EXP-0001-01' }]),
    };
    asignacion = { validar: jest.fn().mockResolvedValue(undefined) };
    auditService = crearAuditService();
    redis = crearRedis();
    service = new RegistroProcesosService(
      registroRepository,
      procesosRepository,
      {} as IReferenciasRepository,
      {} as IUsuariasJuridicoRepository,
      crearAcceso(procesosRepository),
      asignacion as unknown as AsignacionPersonalService,
      redis,
      auditService,
    );
  });

  it('crea el lote, atiende la referencia y audita sin datos de la usuaria', async () => {
    const respuesta = await service.crearLote(EXPEDIENTE_ID, lote(), contexto);

    expect(respuesta).toEqual({
      procesos: [{ id: PROCESO_ID, codigo: 'EXP-0001-01' }],
      usuariaId: USUARIA_ID,
    });
    expect(registroRepository.crearLote).toHaveBeenCalledWith(
      expect.objectContaining({
        expedienteId: EXPEDIENTE_ID,
        numeroExpediente: 'EXP-0001',
        referidoId: REFERIDO_ID,
        creadoPorId: contexto.usuarioId,
      }),
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'PROCESOS_JURIDICOS_CREADOS_LOTE',
        entidad: 'Expediente',
        entidadId: EXPEDIENTE_ID,
        detalles: {
          expedienteId: EXPEDIENTE_ID,
          tipos: ['MEDIDAS_SEGURIDAD'],
          cantidad: 1,
        },
      }),
    );
  });

  it('403 uniforme si el expediente no existe o no fue referido a Jurídico', async () => {
    procesosRepository.buscarExpedienteConAcceso.mockResolvedValue(null);

    await expect(
      service.crearLote(EXPEDIENTE_ID, lote(), contexto),
    ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_EXPEDIENTE));
    expect(registroRepository.crearLote).not.toHaveBeenCalled();
  });

  it('403 si el referidoId no es la referencia de ese expediente', async () => {
    await expect(
      service.crearLote(EXPEDIENTE_ID, lote({ referidoId: OTRO_ID }), contexto),
    ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_REFERENCIA));
    expect(registroRepository.crearLote).not.toHaveBeenCalled();
  });

  it('409 si la referencia ya fue atendida o devuelta', async () => {
    procesosRepository.buscarExpedienteConAcceso.mockResolvedValue(
      expedienteConAcceso({ referenciaPendiente: false }),
    );

    await expect(
      service.crearLote(EXPEDIENTE_ID, lote(), contexto),
    ).rejects.toThrow(new ConflictException(MENSAJE_REFERENCIA_NO_PENDIENTE));
  });

  it('409 si otra persona atendió la referencia justo antes de guardar', async () => {
    registroRepository.crearLote.mockRejectedValue(
      new ReferenciaNoPendienteError(),
    );

    await expect(
      service.crearLote(EXPEDIENTE_ID, lote(), contexto),
    ).rejects.toThrow(new ConflictException(MENSAJE_REFERENCIA_NO_PENDIENTE));
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('sin referencia: registra desde la ficha sin tocar ninguna referencia', async () => {
    procesosRepository.buscarExpedienteConAcceso.mockResolvedValue(
      expedienteConAcceso({ referenciaPendiente: false }),
    );

    await service.crearLote(
      EXPEDIENTE_ID,
      lote({ referidoId: null }),
      contexto,
    );

    expect(registroRepository.crearLote).toHaveBeenCalledWith(
      expect.objectContaining({ referidoId: null }),
    );
  });

  it('400 si el proceso anterior no es de la misma usuaria', async () => {
    registroRepository.listarVinculables.mockResolvedValue([
      { id: PROCESO_ID, codigo: 'EXP-0001-01', tipo: 'DIVORCIO_MUTUO_ACUERDO' },
    ]);
    const datos = lote();
    datos.procesos[0].procesoOrigenId = OTRO_ID;

    await expect(
      service.crearLote(EXPEDIENTE_ID, datos, contexto),
    ).rejects.toThrow(BadRequestException);
    expect(registroRepository.listarVinculables).toHaveBeenCalledWith(
      USUARIA_ID,
    );
    expect(registroRepository.crearLote).not.toHaveBeenCalled();
  });

  it('acepta vincular con un proceso de la misma usuaria', async () => {
    registroRepository.listarVinculables.mockResolvedValue([
      { id: PROCESO_ID, codigo: 'EXP-0001-01', tipo: 'DIVORCIO_MUTUO_ACUERDO' },
    ]);
    const datos = lote();
    datos.procesos[0].procesoOrigenId = PROCESO_ID;

    await service.crearLote(EXPEDIENTE_ID, datos, contexto);

    expect(registroRepository.crearLote).toHaveBeenCalled();
  });

  it('409 con la lista de duplicados si hay un proceso activo del mismo tipo', async () => {
    const duplicados = [{ tipo: 'MEDIDAS_SEGURIDAD', codigo: 'EXP-0001-01' }];
    registroRepository.buscarActivosPorTipo.mockResolvedValue(
      duplicados as never,
    );

    const error = await service
      .crearLote(EXPEDIENTE_ID, lote(), contexto)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual(
      expect.objectContaining({
        codigo: 'DUPLICADOS_ACTIVOS',
        detalle: { duplicados },
      }),
    );
    expect(registroRepository.crearLote).not.toHaveBeenCalled();
  });

  it('crea el duplicado cuando viene confirmado', async () => {
    registroRepository.buscarActivosPorTipo.mockResolvedValue([
      { tipo: 'MEDIDAS_SEGURIDAD', codigo: 'EXP-0001-01' },
    ] as never);

    await service.crearLote(
      EXPEDIENTE_ID,
      lote({ confirmaDuplicados: true }),
      contexto,
    );

    expect(registroRepository.crearLote).toHaveBeenCalled();
  });

  it('400 si la abogada no es válida, sin crear nada', async () => {
    asignacion.validar.mockRejectedValue(new BadRequestException('inválida'));

    await expect(
      service.crearLote(EXPEDIENTE_ID, lote(), contexto),
    ).rejects.toThrow(BadRequestException);
    expect(registroRepository.crearLote).not.toHaveBeenCalled();
  });

  it('un reenvío con la misma Idempotency-Key no crea el lote dos veces', async () => {
    const clave = 'clave-de-prueba-0001';
    const primera = await service.crearLote(
      EXPEDIENTE_ID,
      lote(),
      contexto,
      clave,
    );
    const segunda = await service.crearLote(
      EXPEDIENTE_ID,
      lote(),
      contexto,
      clave,
    );

    expect(segunda).toEqual(primera);
    expect(registroRepository.crearLote).toHaveBeenCalledTimes(1);
    expect(accionesAuditadas(auditService)).toHaveLength(1);
  });

  it('la clave de idempotencia no sirve sin acceso al expediente', async () => {
    const clave = 'clave-de-prueba-0001';
    await service.crearLote(EXPEDIENTE_ID, lote(), contexto, clave);
    procesosRepository.buscarExpedienteConAcceso.mockResolvedValue(null);

    await expect(
      service.crearLote(EXPEDIENTE_ID, lote(), contexto, clave),
    ).rejects.toThrow(ForbiddenException);
  });

  it('400 si la Idempotency-Key tiene un formato inválido', async () => {
    await expect(
      service.crearLote(EXPEDIENTE_ID, lote(), contexto, 'a b'),
    ).rejects.toThrow(BadRequestException);
  });
});
