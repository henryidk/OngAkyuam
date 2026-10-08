import { minutosDelDiaGT } from '@akyuam/shared'

/** Minutos desde la medianoche → "HH:mm" (570 → "09:30"). */
export function horaDeMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  return `${String(horas).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/** Hora de Guatemala ("HH:mm") de un instante — nunca la del navegador. */
export function horaDeInstante(instanteIso: string): string {
  return horaDeMinutos(minutosDelDiaGT(new Date(instanteIso)))
}

/** "45 min", "1 h", "1 h 30 min". */
export function duracionLegible(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  if (horas === 0) return `${resto} min`
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`
}
