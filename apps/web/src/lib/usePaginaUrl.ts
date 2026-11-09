import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Lo mínimo de una página que devuelve el servidor para poder corregir la página pedida. */
interface PaginaServidor {
  items: readonly unknown[]
  total: number
  pagina: number
  porPagina: number
}

function leerPagina(valor: string | null, maximo: number): number {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 1 && numero <= maximo ? numero : 1
}

/**
 * Página de una lista paginada, guardada en `?pagina=` (solo un número: la URL nunca lleva texto
 * buscado). Una búsqueda nueva vuelve a la primera página (la primera vez no: se respeta la URL).
 * Con la respuesta en mano, `usePaginaConFilas` corrige una página que quedó vacía.
 */
export function usePaginaUrl(maximo: number, busqueda: string | undefined) {
  const [params, setParams] = useSearchParams()
  const pagina = leerPagina(params.get('pagina'), maximo)

  /** Cambia varios parámetros de la URL a la vez; `undefined` los quita. */
  const cambiarParams = useCallback(
    (cambios: Record<string, string | undefined>) => {
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales)
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor) nuevos.set(clave, valor)
            else nuevos.delete(clave)
          }
          return nuevos
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const irAPagina = useCallback(
    (nueva: number) => cambiarParams({ pagina: nueva > 1 ? String(nueva) : undefined }),
    [cambiarParams],
  )

  const busquedaAnterior = useRef(busqueda)
  useEffect(() => {
    if (busquedaAnterior.current === busqueda) return
    busquedaAnterior.current = busqueda
    irAPagina(1)
  }, [busqueda, irAPagina])

  return { pagina, params, cambiarParams, irAPagina }
}

/**
 * Si la página pedida quedó vacía (se agendó o dio de alta a la última fila de la última página,
 * o se llegó con un enlace viejo), salta a la última que sí tiene filas.
 */
export function usePaginaConFilas(datos: PaginaServidor | null, irAPagina: (pagina: number) => void) {
  useEffect(() => {
    if (!datos || datos.items.length > 0 || datos.pagina <= 1) return
    irAPagina(Math.max(1, Math.ceil(datos.total / datos.porPagina)))
  }, [datos, irAPagina])
}
