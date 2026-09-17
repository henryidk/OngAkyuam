import { z } from 'zod'
import { AREAS_ATENCION } from '../catalogos/registroUsuaria.js'

/**
 * Áreas que pueden tener personal registrado en Administración. Reusa `AREAS_ATENCION`
 * (jurídica, psicológica, médica) — las mismas 3 áreas que ya comparten el concepto de
 * "área de atención" en el resto del sistema (referidos, visibilidad de documentos).
 * Trabajo social y Administración no necesitan este catálogo: no tienen un concepto de
 * "personal asignado a un caso" hoy.
 */
export const areaPersonalSchema = z.enum(AREAS_ATENCION)
export type AreaPersonal = z.infer<typeof areaPersonalSchema>

export const crearPersonalSchema = z.object({
  area: areaPersonalSchema,
  tipo: z.string().min(1, 'Requerido'),
  nombre: z.string().min(1, 'Requerido'),
})
export type CrearPersonalInput = z.infer<typeof crearPersonalSchema>

export const editarPersonalSchema = z.object({
  nombre: z.string().min(1, 'Requerido'),
  activo: z.boolean(),
})
export type EditarPersonalInput = z.infer<typeof editarPersonalSchema>

/** Query de `GET /personal` — Administración indica qué área quiere ver; cada área ve la suya. */
export const listarPersonalQuerySchema = z.object({
  area: areaPersonalSchema,
  tipo: z.string().min(1).optional(),
})
export type ListarPersonalQuery = z.infer<typeof listarPersonalQuerySchema>

export interface PersonalDto {
  id: string
  area: AreaPersonal
  tipo: string
  nombre: string
  activo: boolean
}
