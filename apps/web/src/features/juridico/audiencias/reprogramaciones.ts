import type { AudienciaDetalleDto } from '@akyuam/shared'

/** Una fecha que tuvo la audiencia antes de reprogramarse, y hacia dónde se movió. */
export interface FechaAnterior {
  audiencia: AudienciaDetalleDto
  /** La fecha siguiente quedó antes ("Se adelantó") o después ("Se pospuso") que esta. */
  sentido: 'ADELANTO' | 'POSPUSO'
}

/** Una tarjeta de la línea de tiempo: la fecha vigente y, de la más reciente a la más antigua, las que reemplazó. */
export interface AudienciaConHistorial {
  audiencia: AudienciaDetalleDto
  anteriores: FechaAnterior[]
}

/**
 * Reprogramar no crea otra audiencia: mueve la misma de fecha. Por eso cada cadena de
 * reprogramaciones va en una sola tarjeta con la fecha vigente al frente. Ordenar las fechas sueltas
 * invertía la historia cuando el juzgado adelantaba una audiencia (la vigente quedaba debajo).
 *
 * Solo se pliegan las de estado REPROGRAMADA. La nueva fecha de una audiencia NO_REALIZADA o
 * CANCELADA sigue siendo otra tarjeta: aquella ocurrió (o se canceló) y tiene su propio resultado.
 * Respeta el orden recibido, que es por fecha de la audiencia vigente.
 */
export function agruparReprogramaciones(audiencias: AudienciaDetalleDto[]): AudienciaConHistorial[] {
  const porId = new Map(audiencias.map((audiencia) => [audiencia.id, audiencia]))
  const plegada = (audiencia: AudienciaDetalleDto) =>
    audiencia.estado === 'REPROGRAMADA' && audiencia.reprogramadaA !== null && porId.has(audiencia.reprogramadaA.id)

  return audiencias
    .filter((audiencia) => !plegada(audiencia))
    .map((vigente) => {
      const anteriores: FechaAnterior[] = []
      let siguiente = vigente
      let previa = vigente.reprogramadaDesde ? porId.get(vigente.reprogramadaDesde.id) : undefined
      while (previa && plegada(previa)) {
        anteriores.push({ audiencia: previa, sentido: siguiente.inicio < previa.inicio ? 'ADELANTO' : 'POSPUSO' })
        siguiente = previa
        previa = previa.reprogramadaDesde ? porId.get(previa.reprogramadaDesde.id) : undefined
      }
      return { audiencia: vigente, anteriores }
    })
}
