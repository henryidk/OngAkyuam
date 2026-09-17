import { TIPOS_PERSONAL_JURIDICO } from './juridico.js'

/**
 * Roles que Administración puede dar de alta como cuentas de login (`Usuario`) desde el
 * módulo de Usuarios. A diferencia de `AREAS_ATENCION` (usada por `Personal`), incluye
 * también TRABAJO_SOCIAL y ADMINISTRACION — este módulo administra el login de todo el
 * personal del sistema, no solo el catálogo de asignación de casos de las áreas de atención.
 */
export const ROLES_CON_LOGIN_ADMINISTRABLES = [
  'TRABAJO_SOCIAL',
  'JURIDICO',
  'PSICOLOGIA',
  'MEDICA',
  'ADMINISTRACION',
] as const

export type RolConLoginAdministrable = (typeof ROLES_CON_LOGIN_ADMINISTRABLES)[number]

export const ETIQUETAS_ROL_CON_LOGIN: Record<RolConLoginAdministrable, string> = {
  TRABAJO_SOCIAL: 'Trabajo social',
  JURIDICO: 'Jurídico',
  PSICOLOGIA: 'Psicológica',
  MEDICA: 'Médica',
  ADMINISTRACION: 'Administración',
}

/**
 * Cargos válidos por área para una cuenta de `Usuario`. ADMINISTRACION queda fuera de este
 * catálogo a propósito: no atiende casos, por lo que no tiene un "puesto" que validar.
 * Jurídico reutiliza `TIPOS_PERSONAL_JURIDICO` (mismos cargos reales que ya usa el catálogo
 * de `Personal`) en vez de duplicar la lista de valores.
 */
export const PUESTOS_POR_AREA: Record<Exclude<RolConLoginAdministrable, 'ADMINISTRACION'>, readonly string[]> = {
  JURIDICO: TIPOS_PERSONAL_JURIDICO,
  TRABAJO_SOCIAL: ['TRABAJADORA_SOCIAL'],
  PSICOLOGIA: ['PSICOLOGA'],
  MEDICA: ['DOCTORA'],
}

export const ETIQUETAS_PUESTO: Record<string, string> = {
  ABOGADA: 'Abogada',
  PROCURADORA: 'Procuradora',
  TRABAJADORA_SOCIAL: 'Trabajadora social',
  PSICOLOGA: 'Psicóloga',
  DOCTORA: 'Doctora',
}
