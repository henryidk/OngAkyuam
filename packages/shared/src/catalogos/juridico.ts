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

// ---- Rediseño del módulo (IMPLEMENTACION_JURIDICO.md). Los catálogos de arriba marcados como
// "estado viejo" siguen existiendo hasta la migración M4 (contraer). ----

type TipoProcesoCatalogo = (typeof TIPOS_PROCESO_JURIDICO)[number]

/** Avance del proceso: solo camina hacia adelante. */
export const FASES_PROCESO_JURIDICO = ['INICIADO', 'EN_PROCESO', 'FINALIZADO'] as const

export const ETIQUETAS_FASE: Record<(typeof FASES_PROCESO_JURIDICO)[number], string> = {
  INICIADO: 'Iniciado',
  EN_PROCESO: 'En proceso',
  FINALIZADO: 'Finalizado',
}

/** Si el caso se está trabajando. Eje independiente de la fase (§2.2 del plan). */
export const SITUACIONES_PROCESO_JURIDICO = ['ACTIVO', 'SUSPENDIDO', 'ABANDONADO'] as const

/** Etiqueta de color que ve el personal: se deriva de fase + situación, nunca se guarda. */
export const ESTADOS_VISIBLES_PROCESO = ['EN_TRAMITE', 'SUSPENDIDO', 'FINALIZADO', 'ABANDONADO'] as const

export const ETIQUETAS_ESTADO_VISIBLE: Record<(typeof ESTADOS_VISIBLES_PROCESO)[number], string> = {
  EN_TRAMITE: 'En trámite',
  SUSPENDIDO: 'Suspendido',
  FINALIZADO: 'Finalizado',
  ABANDONADO: 'Abandonado',
}

export const FORMAS_FINALIZACION_PROCESO = ['CONVENIO', 'SENTENCIA', 'DESISTIMIENTO', 'OTROS'] as const

export const ETIQUETAS_FORMA_FINALIZACION: Record<(typeof FORMAS_FINALIZACION_PROCESO)[number], string> = {
  CONVENIO: 'Convenio',
  SENTENCIA: 'Sentencia',
  DESISTIMIENTO: 'Desistimiento',
  OTROS: 'Otros',
}

export const DESCRIPCIONES_FORMA_FINALIZACION: Record<(typeof FORMAS_FINALIZACION_PROCESO)[number], string> = {
  CONVENIO: 'Acuerdo entre las partes aprobado u homologado',
  SENTENCIA: 'Resolución del juez que pone fin al proceso',
  DESISTIMIENTO: 'La usuaria desiste de la acción ante el juzgado',
  OTROS: 'Cualquier otra forma de conclusión',
}

/**
 * Motivos de abandono. No incluye "desistió voluntariamente": el desistimiento es un acto
 * formal ante el juzgado y por eso es una forma de finalización, no un abandono (§2.4).
 */
export const MOTIVOS_ABANDONO_PROCESO = [
  'NO_RESPONDE',
  'CAMBIO_DOMICILIO',
  'ABOGADO_PARTICULAR',
  'RECONCILIACION',
  'NO_SE_PRESENTO_AUDIENCIAS',
  'OTRO',
] as const

export const ETIQUETAS_MOTIVO_ABANDONO: Record<(typeof MOTIVOS_ABANDONO_PROCESO)[number], string> = {
  NO_RESPONDE: 'No responde a los intentos de contacto',
  CAMBIO_DOMICILIO: 'Cambió de domicilio',
  ABOGADO_PARTICULAR: 'Contrató abogado particular',
  RECONCILIACION: 'Reconciliación con la contraparte',
  NO_SE_PRESENTO_AUDIENCIAS: 'No se presentó a las audiencias',
  OTRO: 'Otro motivo',
}

/** `SISTEMA` la genera solo el backend (creación, cambios de estado, subida de documentos). */
export const TIPOS_ENTRADA_BITACORA = [
  'SEGUIMIENTO',
  'ESCRITO',
  'NOTIFICACION',
  'RESOLUCION',
  'AUDIENCIA',
  'DILIGENCIA',
  'CONTACTO_USUARIA',
  'SISTEMA',
] as const

/** Los tipos que el personal puede elegir al registrar una actuación. */
export const TIPOS_ACTUACION_BITACORA = [
  'SEGUIMIENTO',
  'ESCRITO',
  'NOTIFICACION',
  'RESOLUCION',
  'AUDIENCIA',
  'DILIGENCIA',
  'CONTACTO_USUARIA',
] as const satisfies readonly (typeof TIPOS_ENTRADA_BITACORA)[number][]

export const ETIQUETAS_TIPO_ENTRADA_BITACORA: Record<(typeof TIPOS_ENTRADA_BITACORA)[number], string> = {
  SEGUIMIENTO: 'Seguimiento',
  ESCRITO: 'Escrito',
  NOTIFICACION: 'Notificación',
  RESOLUCION: 'Resolución',
  AUDIENCIA: 'Audiencia',
  DILIGENCIA: 'Diligencia',
  CONTACTO_USUARIA: 'Contacto con usuaria',
  SISTEMA: 'Sistema',
}

export const ACCIONES_PROCESO = ['AVANZAR', 'FINALIZAR', 'SUSPENDER', 'ABANDONAR', 'REACTIVAR'] as const

/** Días sin actuación a partir de los cuales un proceso activo "requiere atención". */
export const DIAS_ALERTA_INACTIVIDAD = 60
export const MAX_PROCESOS_POR_LOTE = 15
export const CONCURRENCIA_SUBIDA = 2
export const PROCESOS_PAGE_SIZE_MAXIMO = 50
export const MAX_RESULTADOS_BUSQUEDA_USUARIAS = 20

/** Agrupación del paso 1 del asistente "Registrar procesos". */
export const CATEGORIAS_PROCESO_JURIDICO = [
  'ALIMENTOS',
  'FAMILIA',
  'EJECUCION',
  'PROTECCION',
  'LABORAL',
  'REFERENCIAS_REGISTRO',
] as const

type CategoriaProcesoCatalogo = (typeof CATEGORIAS_PROCESO_JURIDICO)[number]

export const ETIQUETAS_CATEGORIA_PROCESO: Record<CategoriaProcesoCatalogo, string> = {
  ALIMENTOS: 'Alimentos',
  FAMILIA: 'Familia',
  EJECUCION: 'Ejecución',
  PROTECCION: 'Protección',
  LABORAL: 'Laboral',
  REFERENCIAS_REGISTRO: 'Referencias y registro',
}

export const CATEGORIA_POR_TIPO_PROCESO: Record<TipoProcesoCatalogo, CategoriaProcesoCatalogo> = {
  FIJACION_PENSION_ALIMENTICIA: 'ALIMENTOS',
  MODIFICACION_PENSION_ALIMENTICIA: 'ALIMENTOS',
  DIVORCIO_MUTUO_ACUERDO: 'FAMILIA',
  DIVORCIO_CAUSAL_DETERMINADA: 'FAMILIA',
  PATERNIDAD_FILIACION: 'FAMILIA',
  GUARDA_CUSTODIA: 'FAMILIA',
  RELACIONES_FAMILIARES: 'FAMILIA',
  RECONOCIMIENTO_PRENEZ_PARTO: 'FAMILIA',
  EJECUCION_VIA_APREMIO: 'EJECUCION',
  JUICIO_EJECUTIVO: 'EJECUCION',
  MEDIDAS_SEGURIDAD: 'PROTECCION',
  MENAJE_CASA: 'PROTECCION',
  ORDINARIO_LABORAL: 'LABORAL',
  REFERENCIA_PGN: 'REFERENCIAS_REGISTRO',
  INSCRIPCION_RENAP: 'REFERENCIAS_REGISTRO',
}

/** Procesos que normalmente continúan uno anterior: el asistente recomienda vincularlos. */
export const TIPOS_PROCESO_VINCULO_RECOMENDADO: readonly TipoProcesoCatalogo[] = [
  'EJECUCION_VIA_APREMIO',
  'JUICIO_EJECUTIVO',
  'MODIFICACION_PENSION_ALIMENTICIA',
]

export const CARPETA_DOCUMENTOS_GENERALES = 'Documentos generales'

const CARPETA_EXTRA_POR_TIPO: Partial<Record<TipoProcesoCatalogo, string>> = {
  FIJACION_PENSION_ALIMENTICIA: 'Comprobantes de gastos e ingresos',
  MODIFICACION_PENSION_ALIMENTICIA: 'Comprobantes de gastos e ingresos',
  DIVORCIO_MUTUO_ACUERDO: 'Certificado de matrimonio',
  DIVORCIO_CAUSAL_DETERMINADA: 'Certificado de matrimonio',
  PATERNIDAD_FILIACION: 'Prueba de ADN / dictámenes',
  ORDINARIO_LABORAL: 'Contrato o constancia laboral',
  EJECUCION_VIA_APREMIO: 'Título ejecutivo (sentencia o convenio)',
  JUICIO_EJECUTIVO: 'Título ejecutivo',
  MEDIDAS_SEGURIDAD: 'Denuncia / informe de riesgo',
  INSCRIPCION_RENAP: 'Formularios y constancias RENAP',
}

/** Juicios orales y el laboral: los únicos que producen actas de audiencia. */
const TIPOS_CON_AUDIENCIA: readonly TipoProcesoCatalogo[] = [
  'FIJACION_PENSION_ALIMENTICIA',
  'MODIFICACION_PENSION_ALIMENTICIA',
  'DIVORCIO_MUTUO_ACUERDO',
  'DIVORCIO_CAUSAL_DETERMINADA',
  'PATERNIDAD_FILIACION',
  'GUARDA_CUSTODIA',
  'RELACIONES_FAMILIARES',
  'ORDINARIO_LABORAL',
]

function carpetasSugeridasPara(tipo: TipoProcesoCatalogo): string[] {
  const carpetas = ['DPI de la usuaria']
  const categoria = CATEGORIA_POR_TIPO_PROCESO[tipo]
  if (categoria === 'ALIMENTOS' || categoria === 'FAMILIA') {
    carpetas.push('Certificados de nacimiento de hijos/as')
  }
  const extra = CARPETA_EXTRA_POR_TIPO[tipo]
  if (extra) carpetas.push(extra)
  carpetas.push('Demanda o solicitud presentada', 'Resoluciones y notificaciones')
  if (TIPOS_CON_AUDIENCIA.includes(tipo)) carpetas.push('Actas de audiencia')
  carpetas.push('Sentencia o resolución final')
  return carpetas
}

/**
 * Carpetas que la pestaña Documentos ofrece según el tipo de proceso. Son solo una sugerencia:
 * no existen en la base hasta que alguien las toca (§4.5 del plan).
 */
export const CARPETAS_SUGERIDAS_POR_TIPO = Object.fromEntries(
  TIPOS_PROCESO_JURIDICO.map((tipo) => [tipo, carpetasSugeridasPara(tipo)]),
) as Record<TipoProcesoCatalogo, string[]>

/** Forma canónica del nombre de una carpeta: la que decide si dos nombres "son el mismo". */
export function normalizarNombreCarpeta(nombre: string): string {
  return nombre.trim().toLocaleLowerCase('es')
}
