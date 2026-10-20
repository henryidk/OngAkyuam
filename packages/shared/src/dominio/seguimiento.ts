/**
 * Cartera de Jurídico (planaudiencias.md §2 y §8.6), en un solo lugar para pantallas, API y
 * reportes. Sirve igual para un proceso (su fecha de inicio y si sigue abierto) y para un
 * expediente (la fecha de su primer proceso y si tiene alguno abierto).
 *
 * El año en curso entra como parámetro (`anioActualGT()` en quien llama), nunca se lee del
 * reloj aquí: así la regla es pura y se prueba sin depender de la fecha real.
 */

export interface DatosCartera {
  /** "YYYY-MM-DD": inicio del proceso, o del primer proceso jurídico del expediente. */
  fechaInicio: string
  /** El proceso no está finalizado ni abandonado (o el expediente tiene alguno así). */
  abierto: boolean
}

export type CarteraAsignada = 'ANIO' | 'SEGUIMIENTO'

/** Año de una fecha de calendario "YYYY-MM-DD", sin pasar por `Date` (evita el corrimiento de medianoche). */
export function anioDeFecha(fechaIso: string): number {
  return Number(fechaIso.slice(0, 4))
}

/** Empezó en un año anterior y todavía no se cierra. */
export function esDeSeguimiento(datos: DatosCartera, anioActual: number): boolean {
  return datos.abierto && anioDeFecha(datos.fechaInicio) < anioActual
}

/**
 * `ANIO` si empezó este año; `SEGUIMIENTO` si empezó antes y sigue abierto; `null` si empezó
 * antes y ya se cerró (no pertenece a ninguna de las dos carteras).
 */
export function carteraDe(datos: DatosCartera, anioActual: number): CarteraAsignada | null {
  if (anioDeFecha(datos.fechaInicio) >= anioActual) return 'ANIO'
  return esDeSeguimiento(datos, anioActual) ? 'SEGUIMIENTO' : null
}

/** Texto de la columna Cartera: "2026", "Seguimiento (2024)" o "" (§8.6, reporte B). */
export function etiquetaCartera(datos: DatosCartera, anioActual: number): string {
  const cartera = carteraDe(datos, anioActual)
  if (cartera === 'ANIO') return String(anioDeFecha(datos.fechaInicio))
  if (cartera === 'SEGUIMIENTO') return `Seguimiento (${anioDeFecha(datos.fechaInicio)})`
  return ''
}
