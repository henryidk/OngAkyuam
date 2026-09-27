/**
 * Estado de Trabajo Social sobre un expediente — **derivado**, nunca editado directamente
 * (lo calcula `EstadoTsService` a partir de los referidos y del estado de cada área). "En
 * albergue" es un filtro (`INTERNA` sin `fechaEgresoAlbergue`), no un estado.
 */
export const ESTADOS_TS = ['SIN_REFERIR', 'EN_ATENCION', 'SIN_ATENCION_ACTIVA'] as const

export const ETIQUETAS_ESTADO_TS: Record<(typeof ESTADOS_TS)[number], string> = {
  SIN_REFERIR: 'Sin referir',
  EN_ATENCION: 'En atención',
  SIN_ATENCION_ACTIVA: 'Sin atención activa',
}

/**
 * Tono de `Badge` (`apps/web/src/components/ui/Badge.tsx`) para cada estado, mismo vocabulario
 * de color que el resto del sistema (ver plan de rediseño §12.1). Se replica aquí como valores
 * planos en vez de importar el tipo `BadgeTono` desde `apps/web`, para no crear una dependencia
 * de `shared` hacia el frontend.
 */
export const TONO_BADGE_ESTADO_TS: Record<
  (typeof ESTADOS_TS)[number],
  'warning' | 'success' | 'neutral'
> = {
  SIN_REFERIR: 'warning',
  EN_ATENCION: 'success',
  SIN_ATENCION_ACTIVA: 'neutral',
}

export const PRIORIDADES_REFERIDO = ['NORMAL', 'URGENTE'] as const

export const ETIQUETAS_PRIORIDAD_REFERIDO: Record<(typeof PRIORIDADES_REFERIDO)[number], string> = {
  NORMAL: 'Normal',
  URGENTE: 'Urgente · atender hoy',
}
