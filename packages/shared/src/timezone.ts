import { DateTime } from 'luxon'

/**
 * Guatemala está en UTC-6 fijo, sin horario de verano. Se resuelve siempre
 * por nombre de zona IANA (nunca un offset numérico manual) para no depender
 * de aritmética frágil si algún día cambiara la política horaria.
 */
export const GUATEMALA_TZ = 'America/Guatemala'

/** Fecha de hoy en Guatemala como "YYYY-MM-DD". Usar en vez de `new Date()` cada vez que se necesite "la fecha de hoy" del negocio. */
export function hoyGT(): string {
  return DateTime.now().setZone(GUATEMALA_TZ).toISODate()!
}

/** Medianoche de hoy en Guatemala, como instante UTC — para queries tipo "registros de hoy". */
export function inicioHoyGT(): Date {
  return DateTime.now().setZone(GUATEMALA_TZ).startOf('day').toUTC().toJSDate()
}

/** Formatea un "YYYY-MM-DD" para mostrar (ej. "30/04/2026") por manipulación de string, sin pasar por un objeto Date — elimina el bug de rollover de medianoche. */
export function formatFechaGT(iso: string): string {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

/**
 * Convierte un valor `@db.Date` ya leído de Prisma (JS Date a medianoche UTC de ese día
 * calendario, nunca en hora local) de vuelta a "YYYY-MM-DD" — con `toISOString` porque
 * ya está en UTC; pasarlo por `DateTime.setZone(GUATEMALA_TZ)` aquí sí introduciría el
 * bug de rollover de medianoche que esta disciplina de fechas existe para evitar.
 */
export function fechaColumnaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

/** Formatea un instante real (Timestamptz) a hora de Guatemala para mostrarlo. */
export function formatInstanteGT(fecha: Date | string): string {
  const dt = typeof fecha === 'string' ? DateTime.fromISO(fecha) : DateTime.fromJSDate(fecha)
  return dt.setZone(GUATEMALA_TZ).toFormat('dd/LL/yyyy HH:mm')
}

/** Interpreta un valor de `<input type="datetime-local">` como hora de Guatemala explícita y devuelve el instante UTC correspondiente. */
export function parseLocalGT(valorDatetimeLocal: string): Date {
  return DateTime.fromISO(valorDatetimeLocal, { zone: GUATEMALA_TZ }).toUTC().toJSDate()
}

/** Medianoche de una fecha de calendario "YYYY-MM-DD" en Guatemala, como instante UTC — límite inferior de un rango de fechas (ej. filtrar citas entre `desde` y `hasta`). */
export function inicioDiaGT(fechaIso: string): Date {
  return DateTime.fromISO(fechaIso, { zone: GUATEMALA_TZ }).startOf('day').toUTC().toJSDate()
}

/** Último instante de una fecha de calendario "YYYY-MM-DD" en Guatemala, como instante UTC — límite superior de un rango de fechas. */
export function finDiaGT(fechaIso: string): Date {
  return DateTime.fromISO(fechaIso, { zone: GUATEMALA_TZ }).endOf('day').toUTC().toJSDate()
}

/** Edad en años cumplidos a partir de una fecha de nacimiento "YYYY-MM-DD", calculada en hora de Guatemala. */
export function edadEnAniosGT(fechaNacimientoIso: string): number {
  const nacimiento = DateTime.fromISO(fechaNacimientoIso, { zone: GUATEMALA_TZ })
  const hoy = DateTime.now().setZone(GUATEMALA_TZ)
  return Math.floor(hoy.diff(nacimiento, 'years').years)
}
