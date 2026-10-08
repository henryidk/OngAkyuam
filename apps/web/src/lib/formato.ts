import { fechaCalendarioGT, formatFechaGT } from '@akyuam/shared'

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
