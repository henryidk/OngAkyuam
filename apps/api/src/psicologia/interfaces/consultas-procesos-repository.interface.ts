import type {
  AlcancePsicologia,
  FilaProcesoPsicologia,
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
  /** "Míos" o "Del equipo" (todo proceso del área con responsable). */
  alcance: AlcancePsicologia;
  filtro: FiltroProcesosPsicologia;
  /** Palabras ya limpias; cada una debe aparecer en un nombre (usuaria o hijo/a) o en el número de expediente. */
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
 * Lecturas de procesos. Todas filtran en la propia consulta: de un proceso que no se puede leer
 * no sale ni una fila, aunque alguien olvide el guard de acceso. "Míos" es de la responsable;
 * "Del equipo", el detalle y `listarDeColegas` valen para cualquier proceso que el área puede
 * leer (ver `PROCESO_LEGIBLE`).
 */
export interface IConsultasProcesosRepository {
  listar(
    params: ListarProcesosParams,
  ): Promise<PaginaConCursorRepo<FilaProcesoPsicologia>>;
  /** Todos los procesos que esta psicóloga lleva o llevó de una usuaria, el más reciente primero. */
  listarDeUsuaria(
    usuariaId: string,
    psicologaId: string,
    ahora: Date,
  ): Promise<ProcesoPsicologiaResumen[]>;
  /**
   * Los procesos, abiertos o cerrados, que otras psicólogas llevan o llevaron con una usuaria
   * referida a Psicología (de ella o de sus hijos/as), el más reciente primero.
   */
  listarDeColegas(
    usuariaId: string,
    psicologaId: string,
    ahora: Date,
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
