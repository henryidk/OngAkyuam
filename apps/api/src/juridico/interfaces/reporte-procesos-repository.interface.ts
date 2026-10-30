import type {
  EstadoVisibleProceso,
  FormaFinalizacionProceso,
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
  TIPOLOGIAS_DELITO,
  TipoProcesoJuridico,
} from '@akyuam/shared';
import type { FiltroCarteraReporte } from '../compartido/sql';

export const REPORTE_PROCESOS_REPOSITORY = Symbol(
  'REPORTE_PROCESOS_REPOSITORY',
);

export interface FiltroReporteProcesos extends FiltroCarteraReporte {
  /** null = todos los estados. */
  estado: EstadoVisibleProceso | null;
  /** Abogada o procuradora del proceso; null = todo el personal, incluidos los procesos sin asignar. */
  responsableId: string | null;
  /** null = todos los tipos. */
  tipo: TipoProcesoJuridico | null;
}

export interface FilaProcesoRow {
  /** Correlativo del reporte (`ROW_NUMBER`), no se guarda en la base. */
  numero: number;
  consecutivo: number;
  expedienteNumero: string;
  numeroJudicial: string | null;
  tipo: TipoProcesoJuridico;
  abogada: string | null;
  procuradora: string | null;
  nombres: string;
  apellidos: string;
  telefono: string | null;
  /** Años cumplidos al iniciar el proceso. */
  edad: number;
  grupoEtnico: (typeof GRUPOS_ETNICOS)[number];
  municipio: (typeof MUNICIPIOS_ALTA_VERAPAZ)[number] | null;
  departamentoOtro: string | null;
  municipioOtro: string | null;
  ubicacionGeografica: string | null;
  tipologias: (typeof TIPOLOGIAS_DELITO)[number][];
  /** El último avance registrado por una persona; las entradas del sistema no cuentan. */
  ultimoAvanceEn: Date | null;
  ultimoAvanceTipo: string | null;
  ultimoAvanceContenido: string | null;
}

/** Cuántos procesos hay por (estado, forma, tipo); el servicio arma cada desglose. */
export interface ConteoProcesosRow {
  estado: EstadoVisibleProceso;
  formaFinalizacion: FormaFinalizacionProceso | null;
  tipo: TipoProcesoJuridico;
  total: number;
}

/** Expedientes y usuarias distintos entre los procesos del reporte (§3.3). */
export interface TotalesPersonasRow {
  expedientes: number;
  usuarias: number;
}

export interface IReporteProcesosRepository {
  /** Procesos del reporte en orden; `limite` null = todos (exportación). */
  filas(
    filtro: FiltroReporteProcesos,
    limite: number | null,
  ): Promise<FilaProcesoRow[]>;
  conteos(filtro: FiltroReporteProcesos): Promise<ConteoProcesosRow[]>;
  totalesPersonas(filtro: FiltroReporteProcesos): Promise<TotalesPersonasRow>;
}
