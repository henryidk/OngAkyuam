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

/**
 * Filtros de la lista de Usuarias, en el orden de los chips del prototipo. "En albergue" no es
 * un estado: es `INTERNA` sin `fechaEgresoAlbergue` en el caso activo, y se cruza con los demás.
 */
export const FILTROS_LISTA_USUARIAS = ['SIN_REFERIR', 'EN_ATENCION', 'EN_ALBERGUE', 'SIN_ATENCION_ACTIVA'] as const

export const ETIQUETAS_FILTRO_LISTA_USUARIAS: Record<(typeof FILTROS_LISTA_USUARIAS)[number], string> = {
  SIN_REFERIR: ETIQUETAS_ESTADO_TS.SIN_REFERIR,
  EN_ATENCION: ETIQUETAS_ESTADO_TS.EN_ATENCION,
  EN_ALBERGUE: 'En albergue',
  SIN_ATENCION_ACTIVA: ETIQUETAS_ESTADO_TS.SIN_ATENCION_ACTIVA,
}

/** Filas por página de la lista de Usuarias (plan §3.2). */
export const USUARIAS_POR_PAGINA = 20

/** Estado de un área sobre un caso que le fue referido — lo resuelve la estrategia de cada área. */
export const ESTADOS_AREA = ['ACTIVA', 'CERRADA'] as const

export const ETIQUETAS_ESTADO_AREA: Record<(typeof ESTADOS_AREA)[number], string> = {
  ACTIVA: 'En atención',
  CERRADA: 'Cerrada',
}

export const TONO_BADGE_ESTADO_AREA: Record<(typeof ESTADOS_AREA)[number], 'success' | 'neutral'> = {
  ACTIVA: 'success',
  CERRADA: 'neutral',
}
