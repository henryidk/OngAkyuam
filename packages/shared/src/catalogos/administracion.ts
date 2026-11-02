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
export const PUESTO_PRACTICANTE = 'PRACTICANTE'

/**
 * Cada área tiene sus practicantes, con los mismos permisos que el resto del área: el puesto solo
 * las identifica en pantalla y en reportes ("Nombre (practicante)"). En Jurídico una practicante
 * no es abogada ni procuradora, así que no lleva ficha de personal (ver `usaFichaPersonal`).
 */
export const PUESTOS_POR_AREA: Record<Exclude<RolConLoginAdministrable, 'ADMINISTRACION'>, readonly string[]> = {
  JURIDICO: [...TIPOS_PERSONAL_JURIDICO, PUESTO_PRACTICANTE],
  TRABAJO_SOCIAL: ['TRABAJADORA_SOCIAL', PUESTO_PRACTICANTE],
  PSICOLOGIA: ['PSICOLOGA', PUESTO_PRACTICANTE],
  MEDICA: ['DOCTORA', PUESTO_PRACTICANTE],
}

/** Oficinas de la ONG. Toda cuenta tiene una: la de quien registra un caso es su "Oficina responsable". */
export const SEDES = ['COBAN', 'TACTIC'] as const
export type Sede = (typeof SEDES)[number]

export const ETIQUETAS_SEDE: Record<Sede, string> = {
  COBAN: 'Cobán',
  TACTIC: 'Tactic',
}

export const ETIQUETAS_PUESTO: Record<string, string> = {
  ABOGADA: 'Abogada',
  PROCURADORA: 'Procuradora',
  TRABAJADORA_SOCIAL: 'Trabajadora social',
  PSICOLOGA: 'Psicóloga',
  PRACTICANTE: 'Practicante',
  DOCTORA: 'Doctora',
}

/** Nombre de una persona del personal tal como sale en pantalla y en reportes: las practicantes
 * llevan "(practicante)" para que se sepa quién atendió. */
export function nombreConPuesto(nombreCompleto: string, puesto: string | null): string {
  return puesto === PUESTO_PRACTICANTE ? `${nombreCompleto} (practicante)` : nombreCompleto
}
