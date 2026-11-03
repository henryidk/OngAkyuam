import {
  ESTADOS_AUDIENCIA,
  diasEntreFechasGT,
  formatFechaCortaGT,
  VISTAS_AUDIENCIAS,
  fechaReporteSchema,
  sumarDiasGT,
  type EstadoAudiencia,
  type BuscarAudienciasInput,
  type VistaAudiencias,
} from '@akyuam/shared'

// Filtros de la sección Audiencias que viven en la URL (pestaña, responsable, rango, estado y
// página). El texto buscado nunca: el nombre de una usuaria no debe quedar en el historial.

/** Rango por defecto del Historial: los últimos tres meses, hasta hoy. */
export const DIAS_HISTORIAL_POR_DEFECTO = 90

export interface FiltrosAudiencias {
  vista: VistaAudiencias
  responsableId: string
  mias: boolean
  desde: string
  hasta: string
  estado: EstadoAudiencia | ''
  page: number
  /**
   * Solo en Próximas: los días a los que se acotó la lista (p. ej. al abrir la notificación
   * "Mañana: 2 audiencias"). `null` = todas las próximas.
   */
  rangoProximas: { desde: string; hasta: string } | null
}

function esUno<T extends string>(opciones: readonly T[], valor: string | null): valor is T {
  return valor !== null && (opciones as readonly string[]).includes(valor)
}

function fechaValida(valor: string | null): valor is string {
  return valor !== null && fechaReporteSchema.safeParse(valor).success
}

/** Lee la URL tolerando valores inválidos o editados a mano: caen al valor por defecto. */
export function leerFiltros(params: URLSearchParams, hoy: string): FiltrosAudiencias {
  const vista = params.get('vista')
  const estado = params.get('estado')
  const desde = params.get('desde')
  const hasta = params.get('hasta')
  const vistaLeida = esUno(VISTAS_AUDIENCIAS, vista) ? vista : 'proximas'
  const rangoProximas =
    vistaLeida === 'proximas' && fechaValida(desde) && fechaValida(hasta) && diasEntreFechasGT(desde, hasta) >= 0
      ? { desde, hasta }
      : null
  return {
    vista: vistaLeida,
    responsableId: params.get('responsable') ?? '',
    mias: params.get('mias') === 'true',
    desde: fechaValida(desde) ? desde : sumarDiasGT(hoy, -DIAS_HISTORIAL_POR_DEFECTO),
    hasta: fechaValida(hasta) ? hasta : hoy,
    estado: esUno(ESTADOS_AUDIENCIA, estado) ? estado : '',
    page: Math.max(1, Math.floor(Number(params.get('page'))) || 1),
    rangoProximas,
  }
}

/**
 * Lo que se pide al servidor. El estado solo aplica al Historial; el rango, al Historial y a
 * Próximas cuando se acotó a unos días.
 */
export function queryDesdeFiltros(filtros: FiltrosAudiencias, q: string): BuscarAudienciasInput {
  const historial = filtros.vista === 'historial'
  const rango = historial ? { desde: filtros.desde, hasta: filtros.hasta } : filtros.rangoProximas
  return {
    vista: filtros.vista,
    q: q || undefined,
    responsableId: filtros.mias ? undefined : filtros.responsableId || undefined,
    mias: filtros.mias || undefined,
    desde: rango?.desde,
    hasta: rango?.hasta,
    estado: historial ? filtros.estado || undefined : undefined,
    page: filtros.page,
  }
}

/** Claves de la URL de cada filtro. */
const CLAVE_URL: Record<Exclude<keyof FiltrosAudiencias, 'mias' | 'page' | 'rangoProximas'>, string> = {
  vista: 'vista',
  responsableId: 'responsable',
  desde: 'desde',
  hasta: 'hasta',
  estado: 'estado',
}

/**
 * Aplica cambios a la URL. Cualquier cambio que no sea de página vuelve a la primera; cambiar de
 * pestaña además limpia los filtros propios del Historial.
 */
export function aplicarCambios(actual: URLSearchParams, cambios: Partial<FiltrosAudiencias>): URLSearchParams {
  const siguiente = new URLSearchParams(actual)
  for (const [campo, valor] of Object.entries(cambios) as [keyof FiltrosAudiencias, unknown][]) {
    if (campo === 'page' || campo === 'rangoProximas') continue
    if (campo === 'mias') {
      if (valor) siguiente.set('mias', 'true')
      else siguiente.delete('mias')
      continue
    }
    const clave = CLAVE_URL[campo]
    if (typeof valor === 'string' && valor && !(campo === 'vista' && valor === 'proximas')) siguiente.set(clave, valor)
    else siguiente.delete(clave)
  }
  if (cambios.vista !== undefined) {
    siguiente.delete('desde')
    siguiente.delete('hasta')
    siguiente.delete('estado')
  }
  if (cambios.page !== undefined && cambios.page > 1) siguiente.set('page', String(cambios.page))
  else siguiente.delete('page')
  return siguiente
}

const DIA_RELATIVO: Record<number, string> = { 0: 'hoy', 1: 'mañana', 2: 'pasado mañana' }

/** "de mañana (Mié 4 nov)" o "del Jue 5 nov al Mar 10 nov", para el aviso sobre la tabla. */
export function textoRangoProximas(rango: { desde: string; hasta: string }, hoy: string): string {
  if (rango.desde === rango.hasta) {
    const relativo = DIA_RELATIVO[diasEntreFechasGT(hoy, rango.desde)]
    return relativo ? `de ${relativo} (${formatFechaCortaGT(rango.desde)})` : `del ${formatFechaCortaGT(rango.desde)}`
  }
  return `del ${formatFechaCortaGT(rango.desde)} al ${formatFechaCortaGT(rango.hasta)}`
}
