import type {
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
}

/**
 * Cada método escribe el cambio de estado, su fila de historial y la entrada de bitácora en
 * una sola transacción. Devuelven `false` — sin escribir nada — si la versión ya no coincide.
 * Las reglas de qué transición es válida NO viven aquí: las decide la máquina de estados.
 */
export interface ITransicionesRepository {
  avanzar(params: TransicionBase): Promise<boolean>;
  finalizar(params: FinalizarParams): Promise<boolean>;
  suspender(params: SuspenderParams): Promise<boolean>;
  abandonar(params: AbandonarParams): Promise<boolean>;
  reactivar(params: ReactivarParams): Promise<boolean>;
}

export type { TransicionBase };
