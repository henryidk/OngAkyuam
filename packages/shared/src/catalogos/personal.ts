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

/**
 * Si una cuenta lleva ficha de personal: solo los puestos del catálogo de su área (en Jurídico,
 * abogada y procuradora). Una practicante de Jurídico no se asigna a procesos, así que no tiene
 * ficha. Las cuentas viejas sin puesto se tratan como del catálogo. La usan la API y la web,
 * para que el selector de ficha aparezca exactamente cuando la API la acepta.
 */
export function usaFichaPersonal(rol: string | null | undefined, puesto?: string | null): boolean {
  if (!rol) return false
  const catalogo = CATALOGOS_TIPO_PERSONAL[rol as keyof typeof CATALOGOS_TIPO_PERSONAL]
  return !!catalogo && (!puesto || catalogo.includes(puesto))
}
