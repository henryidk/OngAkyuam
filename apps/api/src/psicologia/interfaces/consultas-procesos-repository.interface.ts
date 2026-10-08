import type {
  FiltroProcesosPsicologia,
  ProcesoPsicologiaDetalle,
  ProcesoPsicologiaResumen,
  ResumenProcesosPsicologia,
  SesionProcesoDto,
} from '@akyuam/shared';
import type { PaginaConCursorRepo } from './atencion-psicologica-repository.interface';

export const CONSULTAS_PROCESOS_REPOSITORY = Symbol(
  'CONSULTAS_PROCESOS_REPOSITORY',
);

export interface ListarProcesosParams {
  psicologaId: string;
  filtro: FiltroProcesosPsicologia;
  /** Palabras ya limpias; cada una debe aparecer en el nombre o en el número de expediente. */
  palabras: string[];
  cursor?: string;
  limite: number;
  /** "Próxima cita" y "sin próxima cita" se miden contra este instante. */
  ahora: Date;
}

export interface ListarSesionesParams {
  procesoId: string;
  cursor?: string;
  limite: number;
}

/** El detalle sin las acciones: esas las decide el dominio a partir de la etapa. */
export type DetalleProcesoRepo = Omit<
  ProcesoPsicologiaDetalle,
  'accionesDisponibles'
>;

/**
 * Lecturas de procesos. Todas filtran por la psicóloga dueña en la propia consulta: de un
 * proceso ajeno no sale ni una fila, aunque alguien olvide el guard de acceso.
 */
export interface IConsultasProcesosRepository {
  listar(
    params: ListarProcesosParams,
  ): Promise<PaginaConCursorRepo<ProcesoPsicologiaResumen>>;
  /** Todos los procesos que esta psicóloga lleva o llevó de una usuaria, el más reciente primero. */
  listarDeUsuaria(
    usuariaId: string,
    psicologaId: string,
    ahora: Date,
  ): Promise<ProcesoPsicologiaResumen[]>;
  resumen(psicologaId: string, ahora: Date): Promise<ResumenProcesosPsicologia>;
  /** `null` tanto si no existe como si es de otra psicóloga. */
  obtenerDetalle(
    procesoId: string,
    psicologaId: string,
    ahora: Date,
  ): Promise<DetalleProcesoRepo | null>;
  /** Sesiones atendidas e inasistencias, de la más reciente a la más antigua. Se usa tras `exigirAccesoProceso`. */
  listarSesiones(
    params: ListarSesionesParams,
  ): Promise<PaginaConCursorRepo<SesionProcesoDto>>;
}
