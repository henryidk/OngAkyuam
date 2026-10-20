import type {
  EstadoVisibleProceso,
  FormaFinalizacionProceso,
  TipoProcesoJuridico,
} from '@akyuam/shared';
import type { FiltroCarteraReporte } from '../compartido/sql';

export const REPORTE_PROCESOS_REPOSITORY = Symbol(
  'REPORTE_PROCESOS_REPOSITORY',
);

export interface FiltroReporteProcesos extends FiltroCarteraReporte {
  /** null = todos los estados. */
  estado: EstadoVisibleProceso | null;
  /** null = todas las abogadas, incluidos los procesos sin abogada. */
  abogadaId: string | null;
  /** null = todos los tipos. */
  tipo: TipoProcesoJuridico | null;
}

export interface FilaProcesoRow {
  /** Correlativo del reporte (`ROW_NUMBER`), no se guarda en la base. */
  numero: number;
  consecutivo: number;
  expedienteNumero: string;
  numeroJudicial: string | null;
  fechaInicio: string;
  fechaCierre: string | null;
  tipo: TipoProcesoJuridico;
  estado: EstadoVisibleProceso;
  /** Ni finalizado ni abandonado: decide la columna Cartera. */
  abierto: boolean;
  formaFinalizacion: FormaFinalizacionProceso | null;
  abogada: string | null;
  nombres: string;
  apellidos: string;
  /** Inicio de la audiencia programada más cercana. */
  proximaAudiencia: Date | null;
  /** Inicio de la última audiencia con resultado "Realizada". */
  ultimaAudienciaRealizada: Date | null;
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
