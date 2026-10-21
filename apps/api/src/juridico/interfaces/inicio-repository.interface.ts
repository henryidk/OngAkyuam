import type {
  CargaActualJuridico,
  ColaInicio,
  MovimientoAnioJuridico,
  NovedadTsDto,
  ProcesoResumen,
  ProcesosPorTipoDto,
} from '@akyuam/shared';

export const INICIO_REPOSITORY = Symbol('INICIO_REPOSITORY');

/**
 * - `ATENCION`: en trámite y sin actuación desde `limiteInactividad()`; la más olvidada primero.
 * - `MIOS`: en trámite con la ficha de personal de la cuenta como abogada o procuradora.
 */
export type ColaProcesosInicio =
  { cola: 'ATENCION' } | { cola: 'MIOS'; usuarioId: string };

export interface IndicadoresInicio {
  cargaActual: CargaActualJuridico;
  movimientoAnio: MovimientoAnioJuridico;
}

export interface IInicioRepository {
  colaProcesos(
    filtro: ColaProcesosInicio,
    limite: number,
  ): Promise<ColaInicio<ProcesoResumen>>;
  /** La carga de hoy y lo abierto y finalizado en ese año calendario. */
  indicadores(anio: number): Promise<IndicadoresInicio>;
  /** Procesos en trámite agrupados por tipo, el más cargado primero. */
  enTramitePorTipo(): Promise<ProcesosPorTipoDto[]>;
  /** ¿La cuenta está vinculada a una ficha de personal de Jurídico? */
  tieneFichaPersonal(usuarioId: string): Promise<boolean>;
  /** Cambios de Trabajo Social sobre expedientes referidos a Jurídico, recientes primero. */
  novedadesTs(limite: number): Promise<NovedadTsDto[]>;
}
