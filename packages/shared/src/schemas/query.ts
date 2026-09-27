import { z } from 'zod'

/**
 * Booleano recibido en query string ("true"/"false"). No se usa `z.coerce.boolean()` porque
 * convierte cualquier string no vacío en `true`, incluido "false".
 */
export const booleanoQuerySchema = z.enum(['true', 'false']).transform((valor) => valor === 'true')
