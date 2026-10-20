import { z } from 'zod'
import { esFechaHoraLocalValidaGT } from '../timezone.js'

/**
 * Valor de `<input type="date">` + `<input type="time">` unidos como "YYYY-MM-DDTHH:mm", en hora
 * de Guatemala (el backend lo convierte con `parseLocalGT`, nunca como UTC directo). Sin
 * segundos: así "la misma hora" es siempre el mismo minuto exacto (planaudiencias.md §5).
 */
export const fechaHoraLocalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Fecha y hora inválidas')
  .refine(esFechaHoraLocalValidaGT, 'Fecha y hora inválidas')
