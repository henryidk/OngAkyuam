import { useEffect, useState } from 'react'
import type { FiltroListaUsuarias, ListaUsuariasTs } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { listarUsuarias } from '../api/trabajoSocial.api'

interface ParametrosLista {
  estado: FiltroListaUsuarias | null
  /** Término ya "confirmado" (con debounce y largo mínimo) — nunca cada tecla. */
  q: string
  pagina: number
}

/** Lista de Usuarias: se vuelve a pedir cada vez que cambian filtro, búsqueda o página. */
export function useListaUsuarias({ estado, q, pagina }: ParametrosLista) {
  const [lista, setLista] = useState<ListaUsuariasTs | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    listarUsuarias({ estado: estado ?? undefined, q: q || undefined, pagina })
      .then((datos) => {
        if (!cancelado) setLista(datos)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [estado, q, pagina])

  return { lista, cargando, error }
}
