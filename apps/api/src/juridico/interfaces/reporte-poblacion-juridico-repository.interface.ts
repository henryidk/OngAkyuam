import type {
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
  TIPOLOGIAS_DELITO,
} from '@akyuam/shared';
import type { FiltroCarteraReporte } from '../compartido/sql';

export const REPORTE_POBLACION_JURIDICO_REPOSITORY = Symbol(
  'REPORTE_POBLACION_JURIDICO_REPOSITORY',
);

/** Solo la cartera: el reporte A no tiene más filtros (planaudiencias.md §8.6). */
export type FiltroReportePoblacionJuridico = FiltroCarteraReporte;

/** Un expediente referido a Jurídico: una fila por usuaria atendida. */
export interface FilaPoblacionJuridicoRow {
  /** Correlativo del reporte (`ROW_NUMBER`), no se guarda en la base. */
  numero: number;
  /** "YYYY-MM-DD": inicio del primer proceso o, sin procesos, la fecha del referido en Guatemala. */
  dia: string;
  numeroCaso: string;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  fechaNacimiento: string;
  /** Años cumplidos al "Día". */
  edad: number;
  grupoEtnico: (typeof GRUPOS_ETNICOS)[number];
  municipio: (typeof MUNICIPIOS_ALTA_VERAPAZ)[number] | null;
  departamentoOtro: string | null;
  municipioOtro: string | null;
  ubicacionGeografica: string | null;
  tipologias: (typeof TIPOLOGIAS_DELITO)[number][];
}

export interface TotalesPoblacionJuridicoRow {
  expedientes: number;
  usuarias: number;
}

export interface IReportePoblacionJuridicoRepository {
  /** Expedientes del reporte en orden; `limite` null = todos (exportación). */
  filas(
    filtro: FiltroReportePoblacionJuridico,
    limite: number | null,
  ): Promise<FilaPoblacionJuridicoRow[]>;
  totales(
    filtro: FiltroReportePoblacionJuridico,
  ): Promise<TotalesPoblacionJuridicoRow>;
}
