import {
  ESTADOS_AUDIENCIA,
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
  return {
    vista: esUno(VISTAS_AUDIENCIAS, vista) ? vista : 'proximas',
    responsableId: params.get('responsable') ?? '',
    mias: params.get('mias') === 'true',
    desde: fechaValida(desde) ? desde : sumarDiasGT(hoy, -DIAS_HISTORIAL_POR_DEFECTO),
    hasta: fechaValida(hasta) ? hasta : hoy,
    estado: esUno(ESTADOS_AUDIENCIA, estado) ? estado : '',
    page: Math.max(1, Math.floor(Number(params.get('page'))) || 1),
  }
}

/** Lo que se pide al servidor. Rango y estado solo aplican al Historial. */
export function queryDesdeFiltros(filtros: FiltrosAudiencias, q: string): BuscarAudienciasInput {
  const historial = filtros.vista === 'historial'
  return {
    vista: filtros.vista,
    q: q || undefined,
    responsableId: filtros.mias ? undefined : filtros.responsableId || undefined,
    mias: filtros.mias || undefined,
    desde: historial ? filtros.desde : undefined,
    hasta: historial ? filtros.hasta : undefined,
    estado: historial ? filtros.estado || undefined : undefined,
    page: filtros.page,
  }
}

/** Claves de la URL de cada filtro. */
const CLAVE_URL: Record<Exclude<keyof FiltrosAudiencias, 'mias' | 'page'>, string> = {
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
    if (campo === 'page') continue
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
