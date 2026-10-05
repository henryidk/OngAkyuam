import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { RedisService } from '../../redis/redis.service';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import type {
  AccesoProceso,
  ExpedienteAccesoJuridico,
  IProcesosRepository,
} from '../interfaces/procesos-repository.interface';

// Dobles compartidos por las pruebas del módulo. Todos los datos son ficticios.

export const EXPEDIENTE_ID = '11111111-1111-4111-8111-111111111111';
export const PROCESO_ID = '22222222-2222-4222-8222-222222222222';
export const REFERIDO_ID = '33333333-3333-4333-8333-333333333333';
export const USUARIA_ID = '44444444-4444-4444-8444-444444444444';
export const CARPETA_ID = '55555555-5555-4555-8555-555555555555';
export const DOCUMENTO_ID = '66666666-6666-4666-8666-666666666666';

export const contexto: ContextoAuditoria = {
  usuarioId: 'usuario-1',
  username: 'juridico.prueba',
};

export function expedienteConAcceso(
  parcial: Partial<ExpedienteAccesoJuridico> = {},
): ExpedienteAccesoJuridico {
  return {
    id: EXPEDIENTE_ID,
    numero: 'EXP-0001',
    usuariaId: USUARIA_ID,
    referidoId: REFERIDO_ID,
    referenciaPendiente: true,
    ...parcial,
  };
}

export function procesoConAcceso(
  parcial: Partial<AccesoProceso> = {},
): AccesoProceso {
  return {
    id: PROCESO_ID,
    expedienteId: EXPEDIENTE_ID,
    usuariaId: USUARIA_ID,
    tipo: 'MEDIDAS_SEGURIDAD',
    fase: 'EN_PROCESO',
    situacion: 'ACTIVO',
    version: 3,
    fechaInicio: '2026-01-10',
    abogadaId: null,
    procuradoraId: null,
    ...parcial,
  };
}

export function crearProcesosRepository(): jest.Mocked<IProcesosRepository> {
  return {
    buscarExpedienteConAcceso: jest
      .fn()
      .mockResolvedValue(expedienteConAcceso()),
    buscarAccesoProceso: jest.fn().mockResolvedValue(procesoConAcceso()),
    listar: jest.fn(),
    resumen: jest.fn(),
    obtenerDetalleBase: jest.fn(),
    listarPorUsuaria: jest.fn().mockResolvedValue([]),
    actualizarDatos: jest.fn().mockResolvedValue('ACTUALIZADO'),
  };
}

/** El servicio de acceso real sobre un repositorio doble: las pruebas ejercen el 403 de verdad. */
export function crearAcceso(
  procesosRepository: IProcesosRepository,
): AccesoJuridicoService {
  return new AccesoJuridicoService(procesosRepository);
}

export function crearAuditService(): jest.Mocked<
  Pick<AuditService, 'registrar'>
> &
  AuditService {
  return {
    registrar: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<AuditService, 'registrar'>> & AuditService;
}

/** Redis en memoria: suficiente para idempotencia y tandas de subida. */
export function crearRedis(): RedisService & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    get: jest.fn((clave: string) => Promise.resolve(datos.get(clave) ?? null)),
    set: jest.fn((clave: string, valor: string) => {
      datos.set(clave, valor);
      return Promise.resolve();
    }),
  } as unknown as RedisService & { datos: Map<string, string> };
}

/** Todas las acciones que se auditaron, en orden. */
export function accionesAuditadas(auditService: AuditService): string[] {
  return (auditService.registrar as jest.Mock).mock.calls.map(
    ([evento]: [{ accion: string }]) => evento.accion,
  );
}
