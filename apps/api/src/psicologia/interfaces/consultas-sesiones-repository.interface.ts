import type {
  AlcancePsicologia,
  ClinicaPsicologia,
  DetalleConsultaPsicologiaDto,
  EstadoHistorialConsultasPsicologia,
  FilaHistorialConsultaPsicologiaDto,
  SesionPorRegistrarDto,
} from '@akyuam/shared';
import type { PaginaConCursorRepo } from './atencion-psicologica-repository.interface';

export const CONSULTAS_SESIONES_REPOSITORY = Symbol(
  'CONSULTAS_SESIONES_REPOSITORY',
);

export interface HistorialSesionesParams {
  psicologaId: string;
  /** "Mías" = las que atendí; "Del equipo" = las de toda el área. */
  alcance: AlcancePsicologia;
  /** Instantes: `desde` incluido, `hasta` excluido. */
  desde: Date;
  hasta: Date;
  /** Palabras ya limpias; cada una debe aparecer en un nombre (usuaria o hijo/a) o en el número de expediente. */
  palabras: string[];
  clinica?: ClinicaPsicologia;
  estado?: EstadoHistorialConsultasPsicologia;
  cursor?: string;
  limite: number;
}

/**
 * Lecturas de la sección Consultas. Filtran en la propia consulta: Por registrar solo trae
 * sesiones que quien consulta puede registrar, y el historial y el detalle solo lo que el área
 * puede leer (ver `PROCESO_LEGIBLE`).
 */
export interface IConsultasSesionesRepository {
  /** Sesiones mías ya empezadas y sin registrar, de la más antigua a la más reciente. */
  porRegistrar(
    psicologaId: string,
    ahora: Date,
  ): Promise<SesionPorRegistrarDto[]>;
  /** Sesiones atendidas e inasistencias, de la más reciente a la más antigua. Sin texto clínico. */
  historial(
    params: HistorialSesionesParams,
  ): Promise<PaginaConCursorRepo<FilaHistorialConsultaPsicologiaDto>>;
  /** `null` si no existe, si el área no puede leerla o si todavía no se registró. */
  detalle(citaId: string): Promise<DetalleConsultaPsicologiaDto | null>;
}
