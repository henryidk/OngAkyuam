import { diasDesdeFechaGT, fechaCalendarioGT, formatFechaGT, horaActualGT } from '@akyuam/shared'

export function saludoSegunHora(): string {
  const hora = horaActualGT()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/** "Hoy", "Ayer", "Hace 3 días" o la fecha, para instantes recientes de las colas y novedades. */
export function cuandoTexto(instanteIso: string): string {
  const fecha = fechaCalendarioGT(new Date(instanteIso))
  const dias = diasDesdeFechaGT(fecha)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `Hace ${dias} días`
  return formatFechaGT(fecha)
}

export function textoDias(dias: number): string {
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}
