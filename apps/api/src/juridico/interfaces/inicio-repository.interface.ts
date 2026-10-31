import type {
  CargaActualJuridico,
  MovimientoAnioJuridico,
  ProcesosPorTipoDto,
} from '@akyuam/shared';

export const INICIO_REPOSITORY = Symbol('INICIO_REPOSITORY');

export interface IndicadoresInicio {
  cargaActual: CargaActualJuridico;
  movimientoAnio: MovimientoAnioJuridico;
}

export interface IInicioRepository {
  /**
   * La carga de hoy (con cuántos son de seguimiento: expediente anterior a `anio`) y lo abierto
   * y finalizado en ese año calendario, mes a mes y por forma de finalización.
   */
  indicadores(anio: number): Promise<IndicadoresInicio>;
  /** Procesos en trámite agrupados por tipo, el más cargado primero. */
  enTramitePorTipo(): Promise<ProcesosPorTipoDto[]>;
}
