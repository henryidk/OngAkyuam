// Catálogos del módulo de Medicina. Una sola fuente de verdad para el frontend, el backend y las
// restricciones `CHECK` de la base (los rangos de signos vitales se comparan contra la migración
// en una prueba del backend).

/** Estado guardado de la atención médica (el episodio de atención de un expediente). */
export const ESTADOS_ATENCION_MEDICA = ['ACTIVA', 'ALTA'] as const

export const ETIQUETAS_ESTADO_ATENCION_MEDICA: Record<(typeof ESTADOS_ATENCION_MEDICA)[number], string> = {
  ACTIVA: 'En atención',
  ALTA: 'De alta',
}

/** Motivo del alta. `OTRO` exige nota. */
export const MOTIVOS_ALTA_MEDICA = ['ALTA_MEDICA', 'REFERIDA_OTRA_INSTITUCION', 'DEJO_DE_ASISTIR', 'OTRO'] as const

export const ETIQUETAS_MOTIVO_ALTA_MEDICA: Record<(typeof MOTIVOS_ALTA_MEDICA)[number], string> = {
  ALTA_MEDICA: 'Alta médica',
  REFERIDA_OTRA_INSTITUCION: 'Referida a otra institución',
  DEJO_DE_ASISTIR: 'Dejó de asistir',
  OTRO: 'Otro',
}

/** Ayuda bajo cada opción del modal de alta. */
export const DESCRIPCIONES_MOTIVO_ALTA_MEDICA: Record<(typeof MOTIVOS_ALTA_MEDICA)[number], string> = {
  ALTA_MEDICA: 'Se resolvió el motivo de consulta',
  REFERIDA_OTRA_INSTITUCION: 'Hospital, centro de salud u otra especialidad',
  DEJO_DE_ASISTIR: 'No regresó y no fue posible contactarla',
  OTRO: 'Describe el motivo en la nota',
}

/** Límite de la nota del alta — el mismo `VarChar(500)` de la base. */
export const NOTA_ALTA_MEDICA_MAX = 500

/** Estado guardado de una cita. `EN_CURSO` y `SIN_REGISTRAR` se derivan, no se guardan. */
export const ESTADOS_CITA_MEDICA = ['PROGRAMADA', 'ATENDIDA', 'NO_ASISTIO', 'CANCELADA'] as const

/** Estado que se muestra: el guardado más los derivados del reloj. */
export const ESTADOS_CITA_MEDICA_DERIVADOS = [...ESTADOS_CITA_MEDICA, 'EN_CURSO', 'SIN_REGISTRAR'] as const

export const ETIQUETAS_ESTADO_CITA_MEDICA: Record<(typeof ESTADOS_CITA_MEDICA_DERIVADOS)[number], string> = {
  PROGRAMADA: 'Programada',
  ATENDIDA: 'Atendida',
  NO_ASISTIO: 'No asistió',
  CANCELADA: 'Cancelada',
  EN_CURSO: 'En curso',
  SIN_REGISTRAR: 'Sin registrar',
}

/** Tipos de documento que la médica adjunta a una consulta. */
export const TIPOS_DOCUMENTO_MEDICO = [
  'RESULTADO_LABORATORIO',
  'RECETA',
  'ORDEN_MEDICA',
  'CONSTANCIA',
  'IMAGEN',
  'OTRO',
] as const

export const ETIQUETAS_TIPO_DOCUMENTO_MEDICO: Record<(typeof TIPOS_DOCUMENTO_MEDICO)[number], string> = {
  RESULTADO_LABORATORIO: 'Resultado de laboratorio',
  RECETA: 'Receta',
  ORDEN_MEDICA: 'Orden médica',
  CONSTANCIA: 'Constancia',
  IMAGEN: 'Imagen / rayos X',
  OTRO: 'Otro',
}

/** Nombre visible de un documento médico — el mismo `VarChar(120)` de la base. */
export const NOMBRE_DOCUMENTO_MEDICO_MAX = 120

// ---- Horario y agenda ----

/** Duración fija de una cita médica. */
export const DURACION_CITA_MEDICA_MIN = 30

/**
 * Horario de la médica: horas de inicio de cita, en hora de Guatemala, de lunes a viernes
 * (mañana 08:00–12:00 y tarde 14:00–15:30, ambas inclusive como hora de inicio). Una lista
 * explícita en vez de una fórmula para que agregar o quitar una hora no toque código.
 */
export const HORARIO_MEDICINA = {
  /** Día ISO (1 = lunes … 7 = domingo). */
  diasLaborables: [1, 2, 3, 4, 5],
  horas: [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00',
    '14:00', '14:30', '15:00', '15:30',
  ],
} as const

export type HoraMedicina = (typeof HORARIO_MEDICINA.horas)[number]

/** Días hábiles que muestra el selector de horario de los modales de programar e inasistencia. */
export const DIAS_DISPONIBILIDAD = 8

/** Máximo de días hábiles que acepta `GET /medica/agenda/disponibilidad`. */
export const MAX_DIAS_DISPONIBILIDAD = 15

/** Días hábiles que ofrece "Próxima consulta" dentro del formulario de consulta. */
export const DIAS_PROXIMA_CONSULTA = 12

// ---- Signos vitales ----

/**
 * Rangos aceptados para cada signo vital. Son los mismos del `CHECK "ConsultaMedica_rangos_chk"`
 * de la migración `medica_restricciones` (hay una prueba que los compara). Son límites de
 * captura, para atajar errores de digitación — no rangos clínicos de normalidad.
 */
export const RANGOS_SIGNOS_VITALES = {
  presionSistolica: { min: 50, max: 260, decimales: 0 },
  presionDiastolica: { min: 30, max: 160, decimales: 0 },
  frecuenciaCardiaca: { min: 20, max: 250, decimales: 0 },
  frecuenciaResp: { min: 4, max: 80, decimales: 0 },
  temperaturaC: { min: 30, max: 45, decimales: 1 },
  saturacionO2: { min: 50, max: 100, decimales: 0 },
  glucosaMgDl: { min: 10, max: 900, decimales: 0 },
  pesoKg: { min: 0.5, max: 400, decimales: 2 },
  tallaM: { min: 0.3, max: 2.5, decimales: 2 },
} as const

export type SignoVital = keyof typeof RANGOS_SIGNOS_VITALES

/**
 * Cómo se muestra cada signo: etiqueta completa (sin abreviaturas), unidad y ejemplo para el
 * placeholder. La presión arterial se captura y se muestra como un solo campo "120/80".
 */
export const SIGNOS_VITALES_FORMULARIO = [
  { clave: 'presionArterial', etiqueta: 'Presión arterial', unidad: 'mmHg', ejemplo: '120/80' },
  { clave: 'frecuenciaCardiaca', etiqueta: 'Frecuencia cardíaca', unidad: 'latidos/min', ejemplo: '80' },
  { clave: 'frecuenciaResp', etiqueta: 'Frecuencia respiratoria', unidad: 'respiraciones/min', ejemplo: '18' },
  { clave: 'temperaturaC', etiqueta: 'Temperatura', unidad: '°C', ejemplo: '36.5' },
  { clave: 'saturacionO2', etiqueta: 'Oxígeno en sangre', unidad: '%', ejemplo: '98' },
  { clave: 'glucosaMgDl', etiqueta: 'Glucosa (glucómetro)', unidad: 'mg/dL', ejemplo: '95' },
  { clave: 'pesoKg', etiqueta: 'Peso', unidad: 'kg', ejemplo: '60.0' },
  { clave: 'tallaM', etiqueta: 'Talla', unidad: 'm', ejemplo: '1.55' },
] as const

export type CampoSignoFormulario = (typeof SIGNOS_VITALES_FORMULARIO)[number]['clave']

// ---- Textos clínicos (mismos límites que la base) ----

export const MOTIVO_CONSULTA_MEDICA_MAX = 2000
export const DIAGNOSTICO_MEDICO_MAX = 2000
export const PLAN_TRATAMIENTO_MAX = 4000
export const RECETA_LABORATORIOS_MAX = 4000

// ---- Pacientes y reportes ----

/** Filtro del listado de pacientes: situación de la usuaria en Medicina. */
export const FILTROS_PACIENTES_MEDICA = ['EN_ATENCION', 'POR_AGENDAR', 'DE_ALTA'] as const

export const ETIQUETAS_FILTRO_PACIENTES_MEDICA: Record<(typeof FILTROS_PACIENTES_MEDICA)[number], string> = {
  EN_ATENCION: 'En atención',
  POR_AGENDAR: 'Por agendar',
  DE_ALTA: 'De alta',
}

export const BUSQUEDA_PACIENTES_MEDICA_MIN = 2
export const BUSQUEDA_PACIENTES_MEDICA_MAX = 80
export const PAGINA_PACIENTES_MEDICA = 30
export const PAGINA_CONSULTAS_MEDICA = 20

/**
 * Un conteo menor que esto se publica como "<3" en el Excel de reportes: en un municipio o un
 * grupo étnico pequeño, una cifra de 1 o 2 personas puede identificar a alguien.
 */
export const UMBRAL_ANONIMATO = 3

// ---- Documentos ----

/** Tiempo de vida de un documento subido antes de guardar la consulta. */
export const HORAS_VIDA_DOCUMENTO_MEDICO_PENDIENTE = 24
