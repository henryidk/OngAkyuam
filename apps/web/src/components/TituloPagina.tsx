import { createContext, useContext, useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react'

export interface MigaPagina {
  etiqueta: string
  ruta?: string
}

export interface DatosTituloPagina {
  titulo: string
  migas?: MigaPagina[]
}

interface ContextoTituloPagina {
  actual: DatosTituloPagina | null
  setActual: (datos: DatosTituloPagina | null) => void
  /** Cuántos `TituloPrincipal` hay montados: si hay alguno, el header no repite el `h1`. */
  titulosPropios: number
  setTitulosPropios: (cambio: (actual: number) => number) => void
}

const TituloPaginaContext = createContext<ContextoTituloPagina | null>(null)

/** Envuelve el árbol de rutas de un área: guarda el título/migas que la pantalla activa declaró. */
export function TituloPaginaProvider({ children }: { children: ReactNode }) {
  const [actual, setActual] = useState<DatosTituloPagina | null>(null)
  const [titulosPropios, setTitulosPropios] = useState(0)
  const valor = useMemo(() => ({ actual, setActual, titulosPropios, setTitulosPropios }), [actual, titulosPropios])
  return <TituloPaginaContext.Provider value={valor}>{children}</TituloPaginaContext.Provider>
}

function useContextoTituloPagina() {
  const contexto = useContext(TituloPaginaContext)
  if (!contexto) {
    throw new Error('Este hook debe usarse dentro de TituloPaginaProvider (ya lo provee SidebarLayout)')
  }
  return contexto
}

/** Para que `SidebarLayout` lea el título/migas que la página actual declaró, o `null` si ninguna lo hizo aún. */
export function useTituloPaginaActual() {
  return useContextoTituloPagina().actual
}

/** Cada pantalla llama esto para poner su título (y, si aplica, sus migas de pan) en el header compartido. */
export function useTituloPagina(datos: DatosTituloPagina) {
  const { setActual } = useContextoTituloPagina()
  const { titulo, migas } = datos
  useEffect(() => {
    setActual({ titulo, migas })
    return () => setActual(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titulo, JSON.stringify(migas)])
}

/** El header compartido usa `h1` solo si la página no trae su propio `TituloPrincipal`. */
export function usePaginaConTituloPropio() {
  return useContextoTituloPagina().titulosPropios > 0
}

/**
 * El `h1` de una pantalla que se titula a sí misma (un solo `h1` por página, WCAG 1.3.1): mientras
 * está montado, el título del header queda como rótulo visual. Fuera de un área (sin provider) es
 * un `h1` normal.
 */
export function TituloPrincipal({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const setTitulosPropios = useContext(TituloPaginaContext)?.setTitulosPropios
  useEffect(() => {
    if (!setTitulosPropios) return
    setTitulosPropios((actual) => actual + 1)
    return () => setTitulosPropios((actual) => actual - 1)
  }, [setTitulosPropios])
  return <h1 {...props}>{children}</h1>
}
