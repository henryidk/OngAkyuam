export const MODALIDADES_CITA = ['PRESENCIAL', 'VIRTUAL'] as const

export const ETIQUETAS_MODALIDAD_CITA: Record<(typeof MODALIDADES_CITA)[number], string> = {
  PRESENCIAL: 'Presencial',
  VIRTUAL: 'Virtual',
}

export const ESTADOS_CITA_PSICOLOGICA = ['PROGRAMADA', 'ATENDIDA', 'CANCELADA', 'NO_ASISTIO'] as const

export const ETIQUETAS_ESTADO_CITA_PSICOLOGICA: Record<(typeof ESTADOS_CITA_PSICOLOGICA)[number], string> = {
  PROGRAMADA: 'Programada',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
}

/** Estado del proceso de atención de una usuaria en psicología (independiente de cada cita). */
export const ESTADOS_ATENCION_PSICOLOGICA = ['INICIO', 'SEGUIMIENTO', 'CIERRE'] as const

export const ETIQUETAS_ESTADO_ATENCION_PSICOLOGICA: Record<(typeof ESTADOS_ATENCION_PSICOLOGICA)[number], string> = {
  INICIO: 'Inicio',
  SEGUIMIENTO: 'En seguimiento',
  CIERRE: 'Cierre',
}
