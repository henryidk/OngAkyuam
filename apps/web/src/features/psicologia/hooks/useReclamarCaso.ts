import axios from 'axios'
import { useCallback, useState } from 'react'
import { extraerMensajeError } from '../../../lib/errors'
import { tomarCaso } from '../api/psicologia.api'

interface DespuesDeReclamar {
  /** El caso quedó a nombre de la psicóloga. */
  alTomar: () => void
  /** Otra psicóloga lo tomó primero (409): la lista que se ve ya no es cierta. */
  alPerderlo: () => void
}

/**
 * Toma una referencia para la psicóloga autenticada. El hook solo se ocupa de la llamada y de
 * sus estados; qué pasa después lo decide quien lo usa, porque es una decisión de la pantalla.
 */
export function useReclamarCaso() {
  const [reclamandoId, setReclamandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reclamar = useCallback(async (referidoId: string, { alTomar, alPerderlo }: DespuesDeReclamar) => {
    setError(null)
    setReclamandoId(referidoId)
    try {
      await tomarCaso(referidoId)
      alTomar()
    } catch (err) {
      setError(extraerMensajeError(err))
      if (axios.isAxiosError(err) && err.response?.status === 409) alPerderlo()
    } finally {
      setReclamandoId(null)
    }
  }, [])

  return { reclamandoId, error, reclamar }
}
