import { z } from 'zod'

/**
 * Booleano recibido en query string ("true"/"false") o ya como `boolean` real: este mismo schema
 * también valida estado en memoria del frontend (ej. un checkbox) antes de armar la petición, no
 * solo el DTO que llega al backend. No se usa `z.coerce.boolean()` porque convierte cualquier
 * string no vacío en `true`, incluido "false".
 */
export const booleanoQuerySchema = z
  .union([z.enum(['true', 'false']), z.boolean()])
  .transform((valor) => (typeof valor === 'boolean' ? valor : valor === 'true'))

/**
 * El regex solo mira la forma: "2026-02-31" pasaría y Postgres fallaría al convertirla a `date`.
 * Aquí se comprueba que el día exista; `Date.UTC` se usa solo para ese cálculo (desborda al
 * mes siguiente si el día no existe), nunca para guardar ni mostrar la fecha.
 */
function esFechaCalendarioReal(iso: string): boolean {
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

/** "YYYY-MM-DD" de un filtro de reporte: fecha de calendario pura y que exista. */
export const fechaReporteSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine(esFechaCalendarioReal, 'Fecha inválida')
