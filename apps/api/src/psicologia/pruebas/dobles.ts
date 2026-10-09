import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { RedisService } from '../../redis/redis.service';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import type {
  IBandejaPsicologiaRepository,
  ReferenciaPsicologia,
} from '../interfaces/bandeja-psicologia-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import type {
  AccesoProcesoPsicologia,
  IProcesosPsicologiaRepository,
} from '../interfaces/procesos-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

// Dobles compartidos por las pruebas del rediseño. Todos los datos son ficticios.

export const EXPEDIENTE_ID = '11111111-1111-4111-8111-111111111111';
export const PROCESO_ID = '22222222-2222-4222-8222-222222222222';
export const REFERIDO_ID = '33333333-3333-4333-8333-333333333333';
export const USUARIA_ID = '44444444-4444-4444-8444-444444444444';
export const NINO_ID = '55555555-5555-4555-8555-555555555555';
export const CITA_ID = '66666666-6666-4666-8666-666666666666';

export const contexto: ContextoAuditoria = {
  usuarioId: 'psicologa-a',
  username: 'psicologia.prueba',
};

export function referencia(
  parcial: Partial<ReferenciaPsicologia> = {},
): ReferenciaPsicologia {
  return {
    referidoId: REFERIDO_ID,
    expedienteId: EXPEDIENTE_ID,
    expedienteNumero: '05-2026',
    usuariaId: USUARIA_ID,
    situacion: 'MIA',
    procesoId: PROCESO_ID,
    ...parcial,
  };
}

export function procesoConAcceso(
  parcial: Partial<AccesoProcesoPsicologia> = {},
): AccesoProcesoPsicologia {
  return {
    id: PROCESO_ID,
    expedienteId: EXPEDIENTE_ID,
    expedienteNumero: '05-2026',
    usuariaId: USUARIA_ID,
    consecutivo: 1,
    etapa: 'SEGUIMIENTO',
    version: 3,
    ...parcial,
  };
}

export function crearBandejaRepository(): jest.Mocked<IBandejaPsicologiaRepository> {
  return {
    listarSinTomar: jest.fn().mockResolvedValue([]),
    listarPorAgendar: jest.fn().mockResolvedValue([]),
    listarPorReasignar: jest.fn().mockResolvedValue([]),
    reasignar: jest.fn().mockResolvedValue(null),
    buscarReferencia: jest.fn().mockResolvedValue(referencia()),
  };
}

export function crearProcesosRepository(): jest.Mocked<IProcesosPsicologiaRepository> {
  return {
    buscarAccesoProceso: jest.fn().mockResolvedValue(procesoConAcceso()),
    buscarLecturaProceso: jest.fn().mockResolvedValue({
      id: PROCESO_ID,
      expedienteId: EXPEDIENTE_ID,
      propio: true,
    }),
    buscarAccesoUsuaria: jest.fn().mockResolvedValue({
      usuariaId: USUARIA_ID,
      expediente: { id: EXPEDIENTE_ID, numero: '05-2026' },
    }),
    ninoPerteneceAExpediente: jest.fn().mockResolvedValue(true),
    abrir: jest.fn().mockResolvedValue({
      procesoId: PROCESO_ID,
      consecutivo: 1,
      citaId: CITA_ID,
    }),
    abrirNuevo: jest.fn().mockResolvedValue({
      procesoId: PROCESO_ID,
      consecutivo: 2,
      citaId: CITA_ID,
    }),
    cerrar: jest.fn().mockResolvedValue({ version: 4, citasCanceladas: 2 }),
    actualizarVisibilidad: jest.fn().mockResolvedValue(4),
  };
}

type CitasParaAcceso = Pick<
  jest.Mocked<ICitasPsicologicasRepository>,
  'buscarCitasSolapadas' | 'buscarAccesoCita' | 'buscarLecturaCita'
> &
  ICitasPsicologicasRepository;

export function crearCitasRepository(): CitasParaAcceso {
  return {
    buscarCitasSolapadas: jest.fn().mockResolvedValue([]),
    buscarAccesoCita: jest.fn().mockResolvedValue({
      id: CITA_ID,
      atencionId: PROCESO_ID,
      expedienteId: EXPEDIENTE_ID,
    }),
    buscarLecturaCita: jest.fn().mockResolvedValue({
      id: CITA_ID,
      atencionId: PROCESO_ID,
      expedienteId: EXPEDIENTE_ID,
      propia: true,
    }),
  } as unknown as CitasParaAcceso;
}

type AtencionParaTomar = Pick<
  jest.Mocked<IAtencionPsicologicaRepository>,
  'tomarCaso'
> &
  IAtencionPsicologicaRepository;

export function crearAtencionRepository(): AtencionParaTomar {
  return {
    tomarCaso: jest.fn().mockResolvedValue('TOMADO'),
  } as unknown as AtencionParaTomar;
}

/** El servicio de acceso real sobre repositorios dobles: las pruebas ejercen el 403 de verdad. */
export function crearAcceso(
  bandejaRepository: IBandejaPsicologiaRepository,
  procesosRepository: IProcesosPsicologiaRepository,
  citasRepository: ICitasPsicologicasRepository = crearCitasRepository(),
): AccesoPsicologiaService {
  return new AccesoPsicologiaService(
    citasRepository,
    bandejaRepository,
    procesosRepository,
  );
}

export function crearAuditService(): jest.Mocked<
  Pick<AuditService, 'registrar'>
> &
  AuditService {
  return {
    registrar: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<AuditService, 'registrar'>> & AuditService;
}

/** Redis en memoria: suficiente para la idempotencia. */
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

interface EventoAuditado {
  accion: string;
  entidadId?: string;
  detalles?: Record<string, unknown>;
}

/** Todo lo que se auditó, en orden. */
export function eventosAuditados(auditService: AuditService): EventoAuditado[] {
  return (auditService.registrar as jest.Mock).mock.calls.map(
    ([evento]: [EventoAuditado]) => evento,
  );
}
