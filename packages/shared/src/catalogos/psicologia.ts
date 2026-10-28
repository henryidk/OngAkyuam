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

/** Consultorio donde se atiende la sesión: se pide al registrar una sesión atendida. */
export const CLINICAS_PSICOLOGIA = ['CLINICA_1', 'CLINICA_2'] as const

export const ETIQUETAS_CLINICA_PSICOLOGIA: Record<(typeof CLINICAS_PSICOLOGIA)[number], string> = {
  CLINICA_1: 'Clínica 1',
  CLINICA_2: 'Clínica 2',
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
 * Sin hueco de almuerzo a propósito: cada psicóloga maneja sus pausas sin que la agenda las imponga.
 */
export const HORARIO_PSICOLOGIA = {
  diasLaborables: [1, 2, 3, 4, 5],
  inicioMin: 8 * 60,
  finMin: 17 * 60,
  /** Un espacio más corto que esto no se ofrece como hueco libre. */
  minimoMin: 30,
  /** Para el día de hoy los huecos arrancan en el siguiente múltiplo de estos minutos. */
  redondeoMin: 15,
} as const

/** Duraciones que ofrece el formulario de cita, de menor a mayor. */
export const DURACIONES_CITA_PSICOLOGICA_MINUTOS = [30, 45, 60] as const
export type DuracionCitaPsicologica = (typeof DURACIONES_CITA_PSICOLOGICA_MINUTOS)[number]

/** La duración que viene seleccionada al programar una cita. */
export const DURACION_CITA_PSICOLOGICA_POR_DEFECTO: DuracionCitaPsicologica = 45

/** El selector de horario ofrece horas de inicio cada tantos minutos ("09:00", "09:30"…). */
export const PASO_HORARIO_PSICOLOGIA_MIN = 30

/** El selector de horario ofrece días hasta tantas semanas adelante (más lejos, "Otra fecha"). */
export const SEMANAS_DISPONIBILIDAD_PSICOLOGIA = 8

/** Filas por página de la lista de Usuarias y de las listas por cursor del rediseño. */
export const USUARIAS_PSICOLOGIA_POR_PAGINA = 20
export const PROCESOS_PSICOLOGIA_POR_PAGINA = 20

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

/** De quién son las filas de Procesos y del historial de Consultas: solo lo mío o toda el área. */
export const ALCANCES_PSICOLOGIA = ['MIOS', 'EQUIPO'] as const

/** Resultados que cuenta el historial de Consultas: las sesiones que de verdad ocurrieron (o se perdieron). */
export const ESTADOS_HISTORIAL_CONSULTAS_PSICOLOGIA = ['ATENDIDA', 'NO_ASISTIO'] as const

export const BUSQUEDA_CONSULTAS_PSICOLOGIA_MIN = 3
export const PAGINA_HISTORIAL_CONSULTAS_PSICOLOGIA = 25
/** Rango máximo del historial: acota lo que puede barrer una sola búsqueda. */
export const MAX_DIAS_RANGO_HISTORIAL_PSICOLOGIA = 366
/** Tope de seguridad de Por registrar: en la práctica son unas pocas. */
export const MAX_SESIONES_POR_REGISTRAR_PSICOLOGIA = 200

export const FILTROS_USUARIAS_PSICOLOGIA = ['CON_ACTIVO', 'SIN_ACTIVO'] as const

export const ETIQUETAS_FILTRO_USUARIAS_PSICOLOGIA: Record<(typeof FILTROS_USUARIAS_PSICOLOGIA)[number], string> = {
  CON_ACTIVO: 'Con proceso activo',
  SIN_ACTIVO: 'Sin proceso activo',
}

/** Áreas a las que la psicóloga puede abrirles etapa, fechas y documentos de un proceso. Trabajo Social no está: siempre los ve. */
export const AREAS_VISIBILIDAD_PROCESO_PSICOLOGIA = ['JURIDICO', 'MEDICA'] as const
