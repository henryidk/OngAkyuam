import type {
  FaseProcesoJuridico,
  FormaFinalizacionProceso,
  MotivoAbandonoProceso,
  SituacionProcesoJuridico,
} from '@akyuam/shared';

export const TRANSICIONES_REPOSITORY = Symbol('TRANSICIONES_REPOSITORY');

interface TransicionBase {
  procesoId: string;
  /** Versión que leyó quien pide el cambio (concurrencia optimista). */
  version: number;
  usuarioId: string;
}

export interface FinalizarParams extends TransicionBase {
  forma: FormaFinalizacionProceso;
  detalle: string | null;
  fechaCierre: string;
}

export interface SuspenderParams extends TransicionBase {
  motivo: string;
}

export interface AbandonarParams extends TransicionBase {
  /** Fecha de calendario (Guatemala) en que se registra el abandono. */
  fecha: string;
  motivoCatalogo: MotivoAbandonoProceso;
  observaciones: string | null;
  ultimoContacto: string | null;
  intentosContacto: number;
  notificadoATs: boolean;
  /** Situación de la que sale: un proceso suspendido cierra su suspensión al abandonarse. */
  situacionActual: SituacionProcesoJuridico;
}

export interface ReactivarParams extends TransicionBase {
  situacionActual: SituacionProcesoJuridico;
  /** Un proceso viejo que quedó en `INICIADO` vuelve como En proceso: ya no hay cómo avanzarlo. */
  faseActual: FaseProcesoJuridico;
}

export interface TransicionAplicada {
  /** Audiencias PROGRAMADAS que se cancelaron solas al finalizar o abandonar (§8.4). */
  audienciasCanceladas: string[];
}

/**
 * Cada método escribe el cambio de estado, su fila de historial y la entrada de bitácora en
 * una sola transacción. Devuelven `null` — sin escribir nada — si la versión ya no coincide.
 * Las reglas de qué transición es válida NO viven aquí: las decide la máquina de estados.
 */
export interface ITransicionesRepository {
  finalizar(params: FinalizarParams): Promise<TransicionAplicada | null>;
  suspender(params: SuspenderParams): Promise<TransicionAplicada | null>;
  abandonar(params: AbandonarParams): Promise<TransicionAplicada | null>;
  reactivar(params: ReactivarParams): Promise<TransicionAplicada | null>;
}

export type { TransicionBase };
