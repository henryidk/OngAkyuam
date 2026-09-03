export type Rol =
  | 'TRABAJO_SOCIAL'
  | 'JURIDICO'
  | 'PSICOLOGIA'
  | 'MEDICA'
  | 'ADMINISTRACION'

export const ROL_HOME: Record<Rol, string> = {
  TRABAJO_SOCIAL: '/trabajo-social',
  JURIDICO: '/juridico',
  PSICOLOGIA: '/psicologia',
  MEDICA: '/medica',
  ADMINISTRACION: '/admin',
}
