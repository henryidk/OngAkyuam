import type { ColaInicio, NovedadTsDto, ProcesoResumen } from '@akyuam/shared';

export const INICIO_REPOSITORY = Symbol('INICIO_REPOSITORY');

/**
 * - `ATENCION`: en trámite y sin actuación desde `limiteInactividad()`; la más olvidada primero.
 * - `MIOS`: en trámite con la ficha de personal de la cuenta como abogada o procuradora.
 * - `RECIENTES`: sin finalizar, con la actuación más reciente primero.
 */
export type ColaProcesosInicio =
  | { cola: 'ATENCION' }
  | { cola: 'MIOS'; usuarioId: string }
  | { cola: 'RECIENTES' };

export interface ResumenAnioJuridico {
  total: number;
  enTramite: number;
  finalizados: number;
}

export interface IInicioRepository {
  colaProcesos(
    filtro: ColaProcesosInicio,
    limite: number,
  ): Promise<ColaInicio<ProcesoResumen>>;
  /** Procesos con fecha de inicio en ese año calendario. */
  resumenAnio(anio: number): Promise<ResumenAnioJuridico>;
  /** ¿La cuenta está vinculada a una ficha de personal de Jurídico? */
  tieneFichaPersonal(usuarioId: string): Promise<boolean>;
  /** Cambios de Trabajo Social sobre expedientes referidos a Jurídico, recientes primero. */
  novedadesTs(limite: number): Promise<NovedadTsDto[]>;
}
