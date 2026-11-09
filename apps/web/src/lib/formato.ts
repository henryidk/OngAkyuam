import {
  ETIQUETAS_MOTIVO_RESERVA_CASO,
  fechaCalendarioGT,
  formatFechaGT,
  horaGT,
  type ReservaCasoDto,
} from '@akyuam/shared'

/** Día de Guatemala ("dd/mm/aaaa") en que ocurrió un instante — nunca el día en UTC. */
export function fechaDeInstante(instanteIso: string): string {
  return formatFechaGT(fechaCalendarioGT(new Date(instanteIso)))
}

export function iniciales(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/)
  const primera = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primera + ultima).toUpperCase()
}

/** "Ana López está agendando · desde 10:15": lo que ven las demás en una referencia reservada. */
export function textoReserva(reserva: ReservaCasoDto): string {
  return `${reserva.nombre} ${ETIQUETAS_MOTIVO_RESERVA_CASO[reserva.motivo]} · desde ${horaGT(reserva.desde)}`
}
