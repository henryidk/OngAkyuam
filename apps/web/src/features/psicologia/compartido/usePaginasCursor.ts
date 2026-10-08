import { useCallback, useState } from 'react'
import type { PaginaConCursor } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { useRecurso } from '../../../lib/useRecurso'

interface PaginasExtra<T> {
  /** A qué lista pertenecen: si la lista cambió (otro filtro, otro proceso) ya no valen. */
  clave: string
  items: T[]
  cursor: string | null
}

/**
 * Lista paginada por cursor con "Cargar más". `clave` identifica la lista que se está viendo y
 * `cargar` debe venir memorizada con `useCallback`: cuando cambian, se empieza de la primera
 * página y lo que estuviera llegando de la lista anterior se descarta.
 */
export function usePaginasCursor<T>(clave: string, cargar: (cursor?: string) => Promise<PaginaConCursor<T>>) {
  const primera = useRecurso(useCallback(() => cargar(), [cargar]))
  const [extra, setExtra] = useState<PaginasExtra<T> | null>(null)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [errorMas, setErrorMas] = useState<string | null>(null)

  const vigente = extra?.clave === clave ? extra : null
  const items = primera.datos ? [...primera.datos.items, ...(vigente?.items ?? [])] : null
  const cursor = vigente ? vigente.cursor : (primera.datos?.siguienteCursor ?? null)

  async function cargarMas() {
    if (!cursor || cargandoMas) return
    setCargandoMas(true)
    setErrorMas(null)
    try {
      const pagina = await cargar(cursor)
      setExtra({ clave, items: [...(vigente?.items ?? []), ...pagina.items], cursor: pagina.siguienteCursor })
    } catch (err) {
      setErrorMas(extraerMensajeError(err))
    } finally {
      setCargandoMas(false)
    }
  }

  const { recargar: recargarPrimera } = primera
  const recargar = useCallback(() => {
    setExtra(null)
    return recargarPrimera()
  }, [recargarPrimera])

  return {
    items,
    error: primera.error,
    cargando: primera.cargando,
    hayMas: cursor !== null,
    cargarMas,
    cargandoMas,
    errorMas,
    recargar,
  }
}
