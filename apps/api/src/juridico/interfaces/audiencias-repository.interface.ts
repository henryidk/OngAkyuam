import type {
  EstadoAudiencia,
  PersonalAsignado,
  ResultadoAudiencia,
} from '@akyuam/shared';
import type { EstadoAudienciaActual } from '../dominio/maquina-estado-audiencia';

export const AUDIENCIAS_REPOSITORY = Symbol('AUDIENCIAS_REPOSITORY');

/** Lo que necesita un servicio para decidir una escritura sobre una audiencia ya agendada. */
export interface AudienciaParaEscritura extends EstadoAudienciaActual {
  id: string;
  procesoId: string;
  estado: EstadoAudiencia;
  responsable: PersonalAsignado;
  version: number;
}

/** Datos comunes de toda escritura: quién la hace y qué deja en la bitácora del proceso. */
interface EscrituraAudiencia {
  procesoId: string;
  usuarioId: string;
  textoBitacora: string;
}

/** Una escritura sobre una audiencia existente exige la versión que se leyó. */
export interface EscrituraSobreAudiencia extends EscrituraAudiencia {
  audienciaId: string;
  version: number;
}

export interface AgendarAudienciaParams extends EscrituraAudiencia {
  inicio: Date;
  responsableId: string;
  descripcion: string | null;
  /** "Agendar nueva fecha" de una cancelada o no realizada. */
  reprogramadaDesdeId: string | null;
  /** Se guarda solo si el proceso todavía no tiene No. judicial. */
  numeroJudicial: string | null;
}

export interface ReprogramarAudienciaParams extends EscrituraSobreAudiencia {
  inicio: Date;
  responsableId: string;
  motivo: string;
}

export interface CambiarResponsableAudienciaParams extends EscrituraSobreAudiencia {
  responsableId: string;
}

export interface RegistrarResultadoAudienciaParams extends EscrituraSobreAudiencia {
  resultado: ResultadoAudiencia;
  observaciones: string | null;
  motivo: string | null;
  numeroJudicial: string | null;
}

export interface ObservacionesAudienciaParams extends EscrituraSobreAudiencia {
  observaciones: string | null;
}

/**
 * Por qué no se guardó. Las cuatro las decide la base dentro de la transacción (versión,
 * índice único parcial, fila del proceso bloqueada), así que valen también ante dos
 * peticiones simultáneas.
 */
export type FalloEscrituraAudiencia =
  | 'VERSION_DESACTUALIZADA'
  | 'HORA_OCUPADA'
  | 'PROCESO_CERRADO'
  | 'YA_TIENE_NUEVA_FECHA';

export type ResultadoEscrituraAudiencia =
  | {
      ok: true;
      /** La audiencia creada (agendar, reprogramar) o la modificada. */
      audienciaId: string;
      /** Se aprovechó para guardar el No. judicial del proceso. */
      numeroJudicialAsignado: boolean;
    }
  | { ok: false; fallo: FalloEscrituraAudiencia };

/**
 * Escrituras de audiencias. Cada una, en una sola transacción: el cambio, la entrada de
 * sistema en la bitácora y `ultimaActuacionEn` del proceso.
 */
export interface IAudienciasRepository {
  /** `null` si la audiencia no existe o su proceso no es de un expediente referido a Jurídico. */
  buscarParaEscritura(
    audienciaId: string,
  ): Promise<AudienciaParaEscritura | null>;
  agendar(params: AgendarAudienciaParams): Promise<ResultadoEscrituraAudiencia>;
  /** Marca la actual REPROGRAMADA y crea la nueva enlazada a ella. */
  reprogramar(
    params: ReprogramarAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia>;
  cambiarResponsable(
    params: CambiarResponsableAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia>;
  registrarResultado(
    params: RegistrarResultadoAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia>;
  editarObservaciones(
    params: ObservacionesAudienciaParams,
  ): Promise<ResultadoEscrituraAudiencia>;
}
