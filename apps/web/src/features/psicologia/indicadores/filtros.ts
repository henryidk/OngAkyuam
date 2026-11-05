import type { IndicadoresQuery } from '@akyuam/shared'

/** Los filtros que comparten las cifras y el Excel (el periodo va aparte). */
export type FiltrosPsicologia = Pick<IndicadoresQuery, 'profesional' | 'estadoProceso' | 'incluirNinos'>

/** Por defecto, todos los procesos del equipo. */
export const FILTROS_INICIALES: FiltrosPsicologia = {
  profesional: 'EQUIPO',
  estadoProceso: 'TODOS',
  incluirNinos: true,
}
