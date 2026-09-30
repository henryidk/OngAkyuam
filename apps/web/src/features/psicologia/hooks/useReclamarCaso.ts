import { useCallback, useState } from 'react'
import { extraerMensajeError } from '../../../lib/errors'
import { tomarCaso } from '../api/psicologia.api'

/**
 * Reclama una referencia para la psicóloga autenticada (§7.4 del plan). El hook solo se ocupa de
 * la llamada y de sus estados; qué pasa después —navegar a agendar o quedarse y refrescar— lo
 * decide quien lo usa, porque es una decisión de la pantalla, no de la operación.
 */
export function useReclamarCaso() {
  const [reclamandoId, setReclamandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reclamar = useCallback(async (expedienteId: string, despues: () => void | Promise<void>) => {
    setError(null)
    setReclamandoId(expedienteId)
    try {
      await tomarCaso(expedienteId)
      await despues()
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setReclamandoId(null)
    }
  }, [])

  return { reclamandoId, error, reclamar }
}
