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

/**
 * Suma (o resta, con delta negativo) días a una fecha de calendario "YYYY-MM-DD" devolviendo
 * otra fecha de calendario. Se apoya en Luxon en vez de `new Date(...)` + `setDate` para no
 * reintroducir el rollover de medianoche que esta disciplina de fechas existe para evitar.
 */
export function sumarDiasGT(fechaIso: string, dias: number): string {
  return DateTime.fromISO(fechaIso, { zone: GUATEMALA_TZ }).plus({ days: dias }).toISODate()!
}

/**
 * Días calendario completos transcurridos en Guatemala desde un instante hasta hoy — el "lleva
 * N días esperando" de las colas de trabajo. Se compara día contra día (no horas entre
 * instantes) para que una referencia de ayer a las 23:00 cuente como 1 y no como 0.
 */
export function diasDesdeGT(instanteIso: string): number {
  const dia = DateTime.fromISO(instanteIso).setZone(GUATEMALA_TZ).startOf('day')
  const hoy = DateTime.now().setZone(GUATEMALA_TZ).startOf('day')
  return Math.max(0, Math.round(hoy.diff(dia, 'days').days))
}

/**
 * Días calendario de Guatemala entre una fecha "YYYY-MM-DD" y hoy — p. ej. los días que lleva en
 * albergue. Guatemala no tiene horario de verano: entre dos medianoches siempre hay días exactos.
 */
export function diasDesdeFechaGT(fechaIso: string): number {
  const dia = DateTime.fromISO(fechaIso, { zone: GUATEMALA_TZ }).startOf('day')
  const hoy = DateTime.now().setZone(GUATEMALA_TZ).startOf('day')
  return Math.max(0, Math.round(hoy.diff(dia, 'days').days))
}

/** Hora actual (0-23) en Guatemala — para el saludo "Buenos días/tardes/noches". */
export function horaActualGT(): number {
  return DateTime.now().setZone(GUATEMALA_TZ).hour
}

/** Año y mes (1-12) actuales en Guatemala — para los agregados "de este mes" con `inicioMesGT`/`finMesGT`. */
export function mesActualGT(): { anio: number; mes: number } {
  const hoy = DateTime.now().setZone(GUATEMALA_TZ)
  return { anio: hoy.year, mes: hoy.month }
}

/** Nombre del mes en español con mayúscula inicial (ej. "Septiembre"). */
export function nombreMesGT(mes: number): string {
  const nombre = DateTime.fromObject({ year: 2000, month: mes, day: 1 }, { zone: GUATEMALA_TZ })
    .setLocale('es')
    .toFormat('LLLL')
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

/** Fecha "YYYY-MM-DD" en texto largo en español (ej. "Lunes 28 de septiembre"). */
export function formatFechaLargaGT(fechaIso: string): string {
  const texto = DateTime.fromISO(fechaIso, { zone: GUATEMALA_TZ })
    .setLocale('es')
    .toFormat("cccc d 'de' LLLL")
  return texto.charAt(0).toUpperCase() + texto.slice(1)
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

/**
 * Día de la semana (1 = lunes … 7 = domingo) y minutos desde la medianoche de un instante, en
 * hora de Guatemala — para comparar una cita contra el horario de atención.
 */
export function momentoSemanalGT(instante: Date): { diaSemana: number; minutosDelDia: number } {
  const local = DateTime.fromJSDate(instante).setZone(GUATEMALA_TZ)
  return { diaSemana: local.weekday, minutosDelDia: local.hour * 60 + local.minute }
}
