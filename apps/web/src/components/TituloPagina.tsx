import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

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
}

const TituloPaginaContext = createContext<ContextoTituloPagina | null>(null)

/** Envuelve el árbol de rutas de un área: guarda el título/migas que la pantalla activa declaró. */
export function TituloPaginaProvider({ children }: { children: ReactNode }) {
  const [actual, setActual] = useState<DatosTituloPagina | null>(null)
  const valor = useMemo(() => ({ actual, setActual }), [actual])
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
