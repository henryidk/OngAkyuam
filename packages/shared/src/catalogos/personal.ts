import { AREAS_ATENCION } from './registroUsuaria.js'
import { TIPOS_PERSONAL_JURIDICO } from './juridico.js'

/**
 * Catálogo de cargos válidos por área, para el módulo `personal` que administra
 * Administración (ver modelo `Personal` en el schema de Prisma). Un área que todavía no
 * tiene catálogo definido (psicológica, médica) acepta cualquier `tipo` no vacío — agregar
 * su catálogo más adelante es agregar una entrada aquí, sin tocar el modelo de datos ni
 * `PersonalService` (OCP).
 */
export const CATALOGOS_TIPO_PERSONAL: Partial<
  Record<(typeof AREAS_ATENCION)[number], readonly string[]>
> = {
  JURIDICO: TIPOS_PERSONAL_JURIDICO,
}
