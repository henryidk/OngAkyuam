import { diasDesdeGT, fechaCalendarioGT, formatFechaGT, type ProcesoResumen } from '@akyuam/shared'

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

/** La fecha que más importa según el estado: el cierre si ya cerró, la última actuación si no. */
export function fechaDeReferencia(proceso: ProcesoResumen): string {
  if (proceso.fechaCierre) return `Cerrado ${formatFechaGT(proceso.fechaCierre)}`
  return `Últ. actuación ${fechaDeInstante(proceso.ultimaActuacionEn)}`
}

export function textoAlerta(proceso: ProcesoResumen): string | null {
  if (!proceso.requiereAtencion) return null
  return `${diasDesdeGT(proceso.ultimaActuacionEn)} días sin actuación`
}
