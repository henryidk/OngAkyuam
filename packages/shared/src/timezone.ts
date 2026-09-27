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

/**
 * Lunes 00:00 de la semana actual en Guatemala, como instante UTC. Usa aritmética explícita
 * sobre `weekday` (1 = lunes ISO) en vez de `.startOf('week')` de Luxon, cuyo primer día
 * depende del locale del proceso — aquí no puede quedar ambiguo entre domingo y lunes.
 */
export function inicioSemanaActualGT(): Date {
  const hoy = DateTime.now().setZone(GUATEMALA_TZ)
  return hoy
    .minus({ days: hoy.weekday - 1 })
    .startOf('day')
    .toUTC()
    .toJSDate()
}

/** Medianoche del primer día del mes (`anio`-`mes`) en Guatemala, como instante UTC — límite inferior para agregados mensuales. */
export function inicioMesGT(anio: number, mes: number): Date {
  return DateTime.fromObject({ year: anio, month: mes, day: 1 }, { zone: GUATEMALA_TZ })
    .startOf('month')
    .toUTC()
    .toJSDate()
}

/** Último instante del mes (`anio`-`mes`) en Guatemala, como instante UTC — límite superior para agregados mensuales. */
export function finMesGT(anio: number, mes: number): Date {
  return DateTime.fromObject({ year: anio, month: mes, day: 1 }, { zone: GUATEMALA_TZ })
    .endOf('month')
    .toUTC()
    .toJSDate()
}

/**
 * Calendario "YYYY-MM-DD" en Guatemala al que pertenece un instante — para agrupar filas ya
 * leídas de la base de datos por día/mes en zona horaria de Guatemala, nunca con `date_trunc`
 * sobre UTC (§7.5 del plan de psicología).
 */
export function fechaCalendarioGT(fecha: Date): string {
  return DateTime.fromJSDate(fecha).setZone(GUATEMALA_TZ).toISODate()!
}

/** Mes "MM" (01-12) en Guatemala al que pertenece un instante — clave de agrupación mensual en agregados. */
export function mesCalendarioGT(fecha: Date): string {
  return DateTime.fromJSDate(fecha).setZone(GUATEMALA_TZ).toFormat('LL')
}
