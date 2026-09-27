export const MODALIDADES_CITA = ['PRESENCIAL', 'VIRTUAL'] as const

export const ETIQUETAS_MODALIDAD_CITA: Record<(typeof MODALIDADES_CITA)[number], string> = {
  PRESENCIAL: 'Presencial',
  VIRTUAL: 'Virtual',
}

export const ESTADOS_CITA_PSICOLOGICA = [
  'PROGRAMADA',
  'ATENDIDA',
  'CANCELADA',
  'NO_ASISTIO',
  'REPROGRAMADA',
] as const

export const ETIQUETAS_ESTADO_CITA_PSICOLOGICA: Record<(typeof ESTADOS_CITA_PSICOLOGICA)[number], string> = {
  PROGRAMADA: 'Programada',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
  REPROGRAMADA: 'Reprogramada',
}

/** Estado del proceso de atención de una usuaria en psicología (independiente de cada cita). */
export const ESTADOS_ATENCION_PSICOLOGICA = ['INICIO', 'SEGUIMIENTO', 'CIERRE'] as const

export const ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA: Record<(typeof ESTADOS_ATENCION_PSICOLOGICA)[number], string> = {
  INICIO: 'Inicio',
  SEGUIMIENTO: 'En seguimiento',
  CIERRE: 'Cierre',
}

/** Tipo de cita — determina el formato del registro clínico esperado (ver §6.2 del plan). */
export const TIPOS_CITA_PSICOLOGICA = ['PRIMERA_ATENCION', 'SEGUIMIENTO', 'CIERRE'] as const

export const ETIQUETAS_TIPO_CITA_PSICOLOGICA: Record<(typeof TIPOS_CITA_PSICOLOGICA)[number], string> = {
  PRIMERA_ATENCION: 'Primera atención',
  SEGUIMIENTO: 'Seguimiento',
  CIERRE: 'Cierre',
}

/** Duración por defecto de una consulta en minutos — decisión pendiente §12.3 del plan, valor propuesto mientras se confirma. */
export const DURACION_CITA_PSICOLOGICA_MINUTOS_DEFAULT = 45
