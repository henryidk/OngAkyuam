import type { PeriodoIndicadores } from '@akyuam/shared'

/**
 * De las citas que ya tuvieron desenlace (atendida o no asistió), qué porcentaje fue
 * inasistencia. Las programadas, canceladas y reprogramadas no cuentan: todavía no "faltó" nadie.
 */
export function porcentajeInasistencia(periodo: Pick<PeriodoIndicadores, 'sesionesRealizadas' | 'inasistencias'>): number {
  const concluidas = periodo.sesionesRealizadas + periodo.inasistencias
  return concluidas === 0 ? 0 : Math.round((periodo.inasistencias / concluidas) * 100)
}

/** Alto o ancho de una barra, en porcentaje del valor más grande de su serie. */
export function proporcion(valor: number, maximo: number): number {
  return maximo <= 0 ? 0 : Math.round((valor / maximo) * 100)
}
