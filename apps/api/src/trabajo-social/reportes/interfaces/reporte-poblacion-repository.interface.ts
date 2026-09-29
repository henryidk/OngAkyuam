import type {
  GRUPOS_ETNICOS,
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
  numeroCaso: string;
  tipoRegistro: TipoRegistro;
  tipologias: TipologiaBd[];
  esUsuaria: boolean;
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
  /** Solo usuarias: la tipología es del caso, no de las hijas/hijos. */
  conteosTipologia(
    filtro: FiltroReportePoblacion,
  ): Promise<ConteoTipologiaRow[]>;
}
