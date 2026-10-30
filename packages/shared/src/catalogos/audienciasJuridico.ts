/**
 * Catálogos de las audiencias judiciales de Jurídico (planaudiencias.md §2 y §6). Misma fuente
 * de verdad para los selects y etiquetas del frontend y la validación del backend.
 */

/** Estado guardado. Espeja el enum `EstadoAudiencia` de `schema.prisma`. */
export const ESTADOS_AUDIENCIA = ['PROGRAMADA', 'REALIZADA', 'NO_REALIZADA', 'CANCELADA', 'REPROGRAMADA'] as const
type EstadoAudienciaCatalogo = (typeof ESTADOS_AUDIENCIA)[number]

export const ETIQUETAS_ESTADO_AUDIENCIA: Record<EstadoAudienciaCatalogo, string> = {
  PROGRAMADA: 'Programada',
  REALIZADA: 'Realizada',
  NO_REALIZADA: 'No se realizó',
  CANCELADA: 'Cancelada',
  REPROGRAMADA: 'Reprogramada',
}

/**
 * Lo que ve el personal: una PROGRAMADA se muestra como Próxima, Hoy o Pendiente de resultado
 * según el reloj. Se deriva al responder, nunca se guarda (cambia sola con el paso del tiempo).
 */
export const ESTADOS_VISIBLES_AUDIENCIA = [
  'PROXIMA',
  'HOY',
  'PENDIENTE_RESULTADO',
  'REALIZADA',
  'NO_REALIZADA',
  'CANCELADA',
  'REPROGRAMADA',
] as const

export const ETIQUETAS_ESTADO_VISIBLE_AUDIENCIA: Record<(typeof ESTADOS_VISIBLES_AUDIENCIA)[number], string> = {
  PROXIMA: 'Próxima',
  HOY: 'Hoy',
  PENDIENTE_RESULTADO: 'Pendiente de resultado',
  REALIZADA: 'Realizada',
  NO_REALIZADA: 'No se realizó',
  CANCELADA: 'Cancelada',
  REPROGRAMADA: 'Reprogramada',
}

/**
 * Por qué se canceló. Espeja el enum `OrigenCancelacionAudiencia` de `schema.prisma`. Ya no hay
 * cancelación manual (antes de la fecha se reprograma; después, se registra el resultado): MANUAL
 * queda solo para mostrar las que se cancelaron así antes de quitar esa acción.
 */
export const ORIGENES_CANCELACION_AUDIENCIA = ['MANUAL', 'PROCESO_FINALIZADO', 'PROCESO_ABANDONADO'] as const

export const ETIQUETAS_ORIGEN_CANCELACION: Record<(typeof ORIGENES_CANCELACION_AUDIENCIA)[number], string> = {
  MANUAL: 'Cancelada',
  PROCESO_FINALIZADO: 'Cancelada por finalización del proceso',
  PROCESO_ABANDONADO: 'Cancelada por abandono del proceso',
}

/** Lo que se puede registrar cuando pasa la fecha. Subconjunto de `ESTADOS_AUDIENCIA`. */
export const RESULTADOS_AUDIENCIA = ['REALIZADA', 'NO_REALIZADA'] as const satisfies readonly EstadoAudienciaCatalogo[]

/** Lo que la máquina de estados permite ahora: el frontend no reimplementa las reglas. */
export const ACCIONES_AUDIENCIA = [
  'REPROGRAMAR',
  'CAMBIAR_RESPONSABLE',
  'REGISTRAR_RESULTADO',
  'EDITAR_OBSERVACIONES',
  'ADJUNTAR_DOCUMENTO',
  'AGENDAR_NUEVA_FECHA',
] as const

/** Pestañas de la sección Audiencias. */
export const VISTAS_AUDIENCIAS = ['proximas', 'pendientes', 'historial'] as const

/**
 * Carpetas de Procesos y Reportes: cada proceso va en la del año de su expediente ("05-2014" →
 * 2014), aunque se haya abierto o retomado años después. El año va en la URL: es un valor de
 * catálogo, no identifica a nadie.
 */
export const ANIO_EXPEDIENTE_MINIMO = 1990
export const ANIO_EXPEDIENTE_MAXIMO = 2100

export const DESCRIPCION_AUDIENCIA_MAX = 80
export const OBSERVACIONES_AUDIENCIA_MAX = 4000
export const MOTIVO_AUDIENCIA_MAX = 300
/** Las abogadas anotan el juzgado o la fiscalía junto al número (ej. "Juzgado de Paz Civil… 16033-2025-00927"). */
export const NUMERO_JUDICIAL_MAX = 250
/** Una audiencia se agenda como máximo a 3 años: más allá casi seguro es un error de captura. */
export const ANIOS_MAXIMOS_AGENDA_AUDIENCIA = 3
/** El Historial exige un rango de fechas de hasta un año, para no traer todo de una vez. */
export const DIAS_MAXIMOS_HISTORIAL_AUDIENCIAS = 366
export const AUDIENCIAS_PAGE_SIZE = 20
/** Paso del `<input type="time">`: solo ayuda visual, el backend acepta cualquier minuto exacto. */
export const PASO_MINUTOS_HORA_AUDIENCIA = 5
/** Carpeta del proceso donde se guardan solos los documentos de las audiencias (§7.4). */
export const CARPETA_AUDIENCIAS = 'Audiencias'

/**
 * Cada juzgado numera distinto, así que no se fuerza formato: solo se quitan espacios de los
 * extremos y los repetidos, para que "C-01  2026" y "C-01 2026" sean el mismo número.
 */
export function normalizarNumeroJudicial(numero: string): string {
  return numero.trim().replace(/\s+/g, ' ')
}
