import type {
  FiltroProcesosPsicologia,
  ProcesoColegaPsicologiaResumen,
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
 * Lecturas de procesos. Todas filtran en la propia consulta por quién pregunta: de un proceso
 * que no puede leer no sale ni una fila, aunque alguien olvide el guard de acceso. Las listas
 * de trabajo son solo de la dueña; el detalle y `listarDeColegas` admiten además el proceso
 * cerrado de una colega (ver `procesoLegible`).
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
  /**
   * Los procesos ya cerrados que otras psicólogas llevaron con una usuaria que esta también
   * atiende o atendió, el más reciente primero. Vacío si no tiene ningún caso con ella.
   */
  listarDeColegas(
    usuariaId: string,
    psicologaId: string,
  ): Promise<ProcesoColegaPsicologiaResumen[]>;
  resumen(psicologaId: string, ahora: Date): Promise<ResumenProcesosPsicologia>;
  /** `null` tanto si no existe como si esta psicóloga no puede leerlo. */
  obtenerDetalle(
    procesoId: string,
    psicologaId: string,
    ahora: Date,
  ): Promise<DetalleProcesoRepo | null>;
  /** Sesiones atendidas e inasistencias, de la más reciente a la más antigua. Se usa tras `exigirLecturaProceso`. */
  listarSesiones(
    params: ListarSesionesParams,
  ): Promise<PaginaConCursorRepo<SesionProcesoDto>>;
}
