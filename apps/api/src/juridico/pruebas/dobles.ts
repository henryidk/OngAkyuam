import type { PersonalAsignado } from '@akyuam/shared';
import type { AuditService } from '../../auth/services/audit.service';
import type { IReloj } from '../../common/reloj';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { IPersonalRepository } from '../../personal/interfaces/personal-repository.interface';
import type { RedisService } from '../../redis/redis.service';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import type {
  AudienciaParaEscritura,
  IAudienciasRepository,
  ResultadoEscrituraAudiencia,
} from '../interfaces/audiencias-repository.interface';
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

// ---- Audiencias ----

export const AUDIENCIA_ID = '77777777-7777-4777-8777-777777777777';
export const ABOGADA_ID = '88888888-8888-4888-8888-888888888888';
export const OTRA_ABOGADA_ID = '99999999-9999-4999-8999-999999999999';

/** Lunes 19/10/2026 09:00 en Guatemala (UTC-6). */
export const AHORA = new Date('2026-10-19T15:00:00.000Z');

export function relojFijo(ahora: Date = AHORA): IReloj {
  return { ahora: () => ahora };
}

export function audienciaParaEscritura(
  parcial: Partial<AudienciaParaEscritura> = {},
): AudienciaParaEscritura {
  return {
    id: AUDIENCIA_ID,
    procesoId: PROCESO_ID,
    estado: 'PROGRAMADA',
    // Miércoles 21/10/2026 09:30 en Guatemala.
    inicio: new Date('2026-10-21T15:30:00.000Z'),
    responsable: { id: ABOGADA_ID, nombre: 'Abogada Ficticia' },
    tieneNuevaFecha: false,
    procesoAbierto: true,
    version: 2,
    ...parcial,
  };
}

export function escrituraOk(
  parcial: Partial<{
    audienciaId: string;
    numeroJudicialAsignado: boolean;
  }> = {},
): ResultadoEscrituraAudiencia {
  return {
    ok: true,
    audienciaId: AUDIENCIA_ID,
    numeroJudicialAsignado: false,
    ...parcial,
  };
}

export function crearAudienciasRepository(): jest.Mocked<IAudienciasRepository> {
  return {
    buscarParaEscritura: jest.fn().mockResolvedValue(audienciaParaEscritura()),
    agendar: jest.fn().mockResolvedValue(escrituraOk()),
    reprogramar: jest.fn().mockResolvedValue(escrituraOk()),
    cancelar: jest.fn().mockResolvedValue(escrituraOk()),
    cambiarResponsable: jest.fn().mockResolvedValue(escrituraOk()),
    registrarResultado: jest.fn().mockResolvedValue(escrituraOk()),
    editarObservaciones: jest.fn().mockResolvedValue(escrituraOk()),
  };
}

/** Personal en memoria: solo las abogadas de la lista están activas. */
export function crearPersonalRepository(
  activas: PersonalAsignado[] = [
    { id: ABOGADA_ID, nombre: 'Abogada Ficticia' },
    { id: OTRA_ABOGADA_ID, nombre: 'Otra Abogada Ficticia' },
  ],
): jest.Mocked<Pick<IPersonalRepository, 'buscarActivo'>> &
  IPersonalRepository {
  return {
    buscarActivo: jest.fn(({ id }: { id: string }) =>
      Promise.resolve(activas.find((p) => p.id === id) ?? null),
    ),
  } as unknown as jest.Mocked<Pick<IPersonalRepository, 'buscarActivo'>> &
    IPersonalRepository;
}
