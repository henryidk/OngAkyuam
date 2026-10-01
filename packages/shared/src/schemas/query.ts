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
