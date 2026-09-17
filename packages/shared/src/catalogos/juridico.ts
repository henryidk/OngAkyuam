/**
 * Catálogo fijo de los procesos judiciales que maneja el área jurídica — misma fuente de
 * verdad para el select del formulario ("Nuevo proceso") y la validación del backend.
 */
export const TIPOS_PROCESO_JURIDICO = [
  'FIJACION_PENSION_ALIMENTICIA',
  'MODIFICACION_PENSION_ALIMENTICIA',
  'DIVORCIO_MUTUO_ACUERDO',
  'DIVORCIO_CAUSAL_DETERMINADA',
  'PATERNIDAD_FILIACION',
  'EJECUCION_VIA_APREMIO',
  'JUICIO_EJECUTIVO',
  'GUARDA_CUSTODIA',
  'MEDIDAS_SEGURIDAD',
  'MENAJE_CASA',
  'RELACIONES_FAMILIARES',
  'RECONOCIMIENTO_PRENEZ_PARTO',
  'REFERENCIA_PGN',
  'ORDINARIO_LABORAL',
  'INSCRIPCION_RENAP',
] as const

export const ETIQUETAS_TIPO_PROCESO_JURIDICO: Record<(typeof TIPOS_PROCESO_JURIDICO)[number], string> = {
  FIJACION_PENSION_ALIMENTICIA: 'Juicio Oral de Fijación de Pensión Alimenticia',
  MODIFICACION_PENSION_ALIMENTICIA: 'Juicio Oral de Modificación (Aumento) de Pensión Alimenticia',
  DIVORCIO_MUTUO_ACUERDO: 'Juicio Oral de Divorcio por Mutuo Acuerdo',
  DIVORCIO_CAUSAL_DETERMINADA: 'Juicio Oral de Divorcio por Causal Determinada',
  PATERNIDAD_FILIACION: 'Juicio Oral de Paternidad y Filiación',
  EJECUCION_VIA_APREMIO: 'Juicio de Ejecución en la Vía de Apremio',
  JUICIO_EJECUTIVO: 'Juicio Ejecutivo',
  GUARDA_CUSTODIA: 'Juicio Oral de Guarda y Custodia',
  MEDIDAS_SEGURIDAD: 'Medidas de Seguridad',
  MENAJE_CASA: 'Menaje de Casa',
  RELACIONES_FAMILIARES: 'Juicio Oral de Relaciones Familiares',
  RECONOCIMIENTO_PRENEZ_PARTO: 'Reconocimiento de Preñez y Parto',
  REFERENCIA_PGN: 'Referencias Casos a PGN',
  ORDINARIO_LABORAL: 'Juicio Ordinario Laboral',
  INSCRIPCION_RENAP: 'Inscripciones RENAP',
}

/**
 * Cargos válidos para el personal del área jurídica (modelo `Personal`, área JURIDICO,
 * gestionado en Administración). `tipo` en `Personal` es texto libre en la base de datos —
 * esta lista es la validación específica de jurídico, no una restricción de esquema; otras
 * áreas definen su propio catálogo de cargos sin tocar el modelo compartido.
 */
export const TIPOS_PERSONAL_JURIDICO = ['ABOGADA', 'PROCURADORA'] as const

export const ETIQUETAS_TIPO_PERSONAL_JURIDICO: Record<(typeof TIPOS_PERSONAL_JURIDICO)[number], string> = {
  ABOGADA: 'Abogada',
  PROCURADORA: 'Procuradora',
}

/** Únicos 2 estados de un proceso (decisión de negocio confirmada, ver planjuridico.md). */
export const ESTADOS_PROCESO_JURIDICO = ['INICIADO', 'CERRADO'] as const

export const ETIQUETAS_ESTADO_PROCESO_JURIDICO: Record<(typeof ESTADOS_PROCESO_JURIDICO)[number], string> = {
  INICIADO: 'Iniciado',
  CERRADO: 'Cerrado',
}

/**
 * Filtro de la vista global "Procesos" — no es un estado de la base de datos: un proceso es
 * "FINALIZADO" si está `CERRADO` o tiene un abandono registrado, "EN_CURSO" en otro caso.
 */
export const FILTROS_PROCESO_JURIDICO = ['EN_CURSO', 'FINALIZADO'] as const
