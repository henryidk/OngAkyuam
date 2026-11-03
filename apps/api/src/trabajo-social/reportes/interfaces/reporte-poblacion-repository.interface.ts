import type {
  AreaAtencion,
  AreaResidencia,
  CondicionMaternidad,
  GRUPOS_ETNICOS,
  IdiomaAtencion,
  Sede,
  TIPOS_PROCESO_JURIDICO,
  MUNICIPIOS_ALTA_VERAPAZ,
  TIPOLOGIAS_DELITO,
  TipoRegistro,
} from '@akyuam/shared';

export const REPORTE_POBLACION_REPOSITORY = Symbol(
  'REPORTE_POBLACION_REPOSITORY',
);

export type GrupoEtnicoBd = (typeof GRUPOS_ETNICOS)[number];
export type TipologiaBd = (typeof TIPOLOGIAS_DELITO)[number];

export interface FiltroReportePoblacion {
  /** "YYYY-MM-DD", inclusive — se compara contra la fecha del caso. */
  desde: string;
  hasta: string;
  /** null = interna y externa. */
  tipoRegistro: TipoRegistro | null;
  incluirNinos: boolean;
  /** Solo casos de usuarias cuyo primer expediente (de todos) cae en el rango. */
  soloNuevas: boolean;
}

/**
 * Una persona del reporte: la usuaria de un caso o una hija/hijo de ese caso. Los datos de
 * lugar y grupo étnico ya vienen de la madre en las filas de niños.
 */
export interface FilaPoblacionRow {
  /** Correlativo del reporte (`ROW_NUMBER`), no se guarda en la base. */
  numero: number;
  /** Fecha del caso, "YYYY-MM-DD". */
  fecha: string;
  expedienteNumero: string;
  /** Consecutivo del hijo/a dentro del expediente; null en la fila de la usuaria. */
  ninoConsecutivo: number | null;
  tipoRegistro: TipoRegistro;
  tipologias: TipologiaBd[];
  esUsuaria: boolean;
  /** Primer expediente de la usuaria dentro del rango; en hijas/hijos, el de la madre. */
  usuariaNueva: boolean;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  fechaNacimiento: string;
  /** Años cumplidos a la fecha del caso. */
  edad: number;
  /** Solo en filas de niños. */
  generoNino: 'MUJER' | 'HOMBRE' | null;
  grupoEtnico: GrupoEtnicoBd;
  municipio: (typeof MUNICIPIOS_ALTA_VERAPAZ)[number] | null;
  departamentoOtro: string | null;
  municipioOtro: string | null;
  ubicacionGeografica: string | null;
  /** Solo de la usuaria: null en las filas de hijas/hijos. */
  telefono: string | null;
  areaResidencia: AreaResidencia;
  /** Solo de la usuaria. */
  ocupacion: string | null;
  /** Solo de la usuaria. */
  condicionMaternidad: CondicionMaternidad | null;
  idiomaAtencion: IdiomaAtencion;
  /** Quien registró el caso y su sede ("Oficina responsable"). */
  atendidaPorNombre: string;
  atendidaPorPuesto: string | null;
  sede: Sede;
  /**
   * Columnas "Referida al área" con X, en quien recibe la atención: Psicología/Medicina donde la
   * persona tiene atención propia; Jurídico (solo la usuaria) por la referencia. Una referencia
   * a Psicología/Medicina que aún no atiende a nadie del caso se marca en la usuaria.
   */
  areasMarcadas: AreaAtencion[];
  /**
   * Motivo de la referencia más antigua que tiene motivo. En una hija/hijo, solo si se le
   * atiende en un área referida; si no, null.
   */
  motivoReferencia: string | null;
  /** Bitácora de Trabajo Social del caso; vacío en filas de hijas/hijos. */
  accionesTrabajoSocial: { fecha: string; texto: string }[];
  /** Tipos de proceso jurídico del caso, sin repetir; vacío en filas de hijas/hijos. */
  procesosJuridicos: (typeof TIPOS_PROCESO_JURIDICO)[number][];
  /** Atención brindada en cada sesión de Psicología atendida de esta persona (instante ISO). */
  atencionesPsicologicas: { fechaHora: string; texto: string }[];
  /** Atención brindada en cada consulta médica de esta persona (instante ISO). */
  atencionesMedicas: { fechaHora: string; texto: string }[];
}

/** Cuántas personas hay por (usuaria/niño, edad, grupo étnico); el servicio lo agrupa por rango. */
export interface ConteoDemograficoRow {
  esUsuaria: boolean;
  edad: number;
  grupoEtnico: GrupoEtnicoBd;
  total: number;
}

export interface ConteoTipologiaRow {
  tipologia: TipologiaBd;
  total: number;
}

export interface IReportePoblacionRepository {
  /** Personas del reporte en orden; `limite` null = todas (exportación). */
  filas(
    filtro: FiltroReportePoblacion,
    limite: number | null,
  ): Promise<FilaPoblacionRow[]>;
  conteosDemograficos(
    filtro: FiltroReportePoblacion,
  ): Promise<ConteoDemograficoRow[]>;
  /** Usuarias distintas de los casos del reporte que son nuevas en el periodo. */
  contarUsuariasNuevas(filtro: FiltroReportePoblacion): Promise<number>;
  /** Solo usuarias: la tipología es del caso, no de las hijas/hijos. */
  conteosTipologia(
    filtro: FiltroReportePoblacion,
  ): Promise<ConteoTipologiaRow[]>;
}
