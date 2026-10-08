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

// ---- Rediseño del módulo (proceso psicológico, agenda con huecos, bandeja del área) ----

/** Motivo de cierre de un proceso psicológico — catálogo fijo; `OTRO` exige resumen de cierre. */
export const MOTIVOS_CIERRE_PSICOLOGIA = [
  'OBJETIVOS_CUMPLIDOS',
  'DEJO_DE_ASISTIR',
  'REFERIDA_OTRA_INSTITUCION',
  'DECISION_USUARIA',
  'OTRO',
] as const

export const ETIQUETAS_MOTIVO_CIERRE_PSICOLOGIA: Record<(typeof MOTIVOS_CIERRE_PSICOLOGIA)[number], string> = {
  OBJETIVOS_CUMPLIDOS: 'Objetivos cumplidos',
  DEJO_DE_ASISTIR: 'Dejó de asistir',
  REFERIDA_OTRA_INSTITUCION: 'Referida a otra institución',
  DECISION_USUARIA: 'Decisión de la usuaria',
  OTRO: 'Otro',
}

/**
 * Horario de atención del área, en minutos desde la medianoche de Guatemala — de aquí sale el
 * cálculo de huecos libres de la agenda. `diasLaborables` usa el día ISO (1 = lunes … 7 = domingo).
 */
export const HORARIO_PSICOLOGIA = {
  diasLaborables: [1, 2, 3, 4, 5],
  inicioMin: 8 * 60,
  finMin: 17 * 60,
  almuerzoInicioMin: 12 * 60,
  almuerzoFinMin: 13 * 60,
  /** Un espacio más corto que esto no se ofrece como hueco libre. */
  minimoMin: 45,
  /** Para el día de hoy los huecos arrancan en el siguiente múltiplo de estos minutos. */
  redondeoMin: 15,
} as const

/** Duraciones que ofrece el formulario de cita. La primera es la que viene seleccionada. */
export const DURACIONES_CITA_PSICOLOGICA_MINUTOS = [45, 60, 90] as const

/** Una referencia sin tomar con estos días de espera o más se resalta en el Área de atención. */
export const DIAS_ALERTA_ESPERA_PSICOLOGIA = 5

/** Filtros de la lista de Procesos. `SIN_PROXIMA` = activos que se quedaron sin siguiente fecha. */
export const FILTROS_PROCESOS_PSICOLOGIA = ['ACTIVOS', 'INICIO', 'SEGUIMIENTO', 'SIN_PROXIMA', 'CERRADOS'] as const

export const ETIQUETAS_FILTRO_PROCESOS_PSICOLOGIA: Record<(typeof FILTROS_PROCESOS_PSICOLOGIA)[number], string> = {
  ACTIVOS: 'Activos',
  INICIO: 'Inicio',
  SEGUIMIENTO: 'En seguimiento',
  SIN_PROXIMA: 'Sin próxima cita',
  CERRADOS: 'Cerrados',
}

export const FILTROS_USUARIAS_PSICOLOGIA = ['REFERENCIA_NUEVA', 'CON_ACTIVO', 'SIN_ACTIVO'] as const

export const ETIQUETAS_FILTRO_USUARIAS_PSICOLOGIA: Record<(typeof FILTROS_USUARIAS_PSICOLOGIA)[number], string> = {
  REFERENCIA_NUEVA: 'Referencia nueva',
  CON_ACTIVO: 'Con proceso activo',
  SIN_ACTIVO: 'Sin proceso activo',
}

/** Áreas a las que la psicóloga puede abrirles etapa, fechas y documentos de un proceso. Trabajo Social no está: siempre los ve. */
export const AREAS_VISIBILIDAD_PROCESO_PSICOLOGIA = ['JURIDICO', 'MEDICA'] as const
