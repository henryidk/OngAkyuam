import type {
  EstadoVisibleProceso,
  FormaFinalizacionProceso,
  GRUPOS_ETNICOS,
  MUNICIPIOS_ALTA_VERAPAZ,
  TipoProcesoJuridico,
} from '@akyuam/shared';

export const REPORTE_PROCESOS_REPOSITORY = Symbol(
  'REPORTE_PROCESOS_REPOSITORY',
);

export interface FiltroReporteProcesos {
  /** "YYYY-MM-DD", inclusive — se compara contra la fecha de inicio del proceso. */
  desde: string;
  hasta: string;
  /** null = todos los estados. */
  estado: EstadoVisibleProceso | null;
  /** null = todas las abogadas, incluidos los procesos sin abogada. */
  abogadaId: string | null;
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
  formaFinalizacion: FormaFinalizacionProceso | null;
  abogada: string | null;
  nombres: string;
  apellidos: string;
  /** Años cumplidos a la fecha de inicio del proceso. */
  edad: number;
  grupoEtnico: (typeof GRUPOS_ETNICOS)[number];
  municipio: (typeof MUNICIPIOS_ALTA_VERAPAZ)[number] | null;
  municipioOtro: string | null;
}

/** Cuántos procesos hay por (estado, forma, tipo); el servicio arma cada desglose. */
export interface ConteoProcesosRow {
  estado: EstadoVisibleProceso;
  formaFinalizacion: FormaFinalizacionProceso | null;
  tipo: TipoProcesoJuridico;
  total: number;
}

export interface IReporteProcesosRepository {
  /** Procesos del reporte en orden; `limite` null = todos (exportación). */
  filas(
    filtro: FiltroReporteProcesos,
    limite: number | null,
  ): Promise<FilaProcesoRow[]>;
  conteos(filtro: FiltroReporteProcesos): Promise<ConteoProcesosRow[]>;
  /** Usuarias distintas entre los procesos del reporte. */
  usuariasDistintas(filtro: FiltroReporteProcesos): Promise<number>;
}
