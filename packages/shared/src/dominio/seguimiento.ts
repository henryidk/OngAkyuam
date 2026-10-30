/**
 * Carpetas de Jurídico, en un solo lugar para pantallas, API y reportes. Cada proceso va en la
 * carpeta del año de su expediente ("05-2014" → 2014): la carpeta no cambia con el tiempo, así que
 * un proceso abierto en 2026 sigue en 2026 aunque continúe en 2027, y un proceso nuevo sobre un
 * expediente de 2014 va en 2014.
 *
 * El año en curso entra como parámetro (`anioActualGT()` en quien llama), nunca se lee del
 * reloj aquí: así la regla es pura y se prueba sin depender de la fecha real.
 */

export interface DatosCartera {
  /** Año del expediente (el de su fecha de registro, el mismo de "NN-AAAA"). */
  anioExpediente: number
  /** El proceso no está finalizado ni abandonado. */
  abierto: boolean
}

/** Año de una fecha de calendario "YYYY-MM-DD", sin pasar por `Date` (evita el corrimiento de medianoche). */
export function anioDeFecha(fechaIso: string): number {
  return Number(fechaIso.slice(0, 4))
}

/** El expediente es de un año anterior y el proceso todavía no se cierra: chip "Seguimiento · 2014". */
export function esDeSeguimiento(datos: DatosCartera, anioActual: number): boolean {
  return datos.abierto && datos.anioExpediente < anioActual
}
