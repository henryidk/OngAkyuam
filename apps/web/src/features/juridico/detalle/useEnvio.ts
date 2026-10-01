import { useState } from 'react'
import { extraerMensajeError } from '../../../lib/errors'
import { esConflicto } from './contextoDetalle'

/** Estado de envío de un modal de acción: una sola petición a la vez, error visible y aviso de conflicto. */
export function useEnvio(onConflicto: () => void) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(peticion: () => Promise<unknown>, alTerminar: () => void) {
    setError(null)
    setEnviando(true)
    try {
      await peticion()
      alTerminar()
    } catch (err) {
      setError(extraerMensajeError(err))
      if (esConflicto(err)) onConflicto()
    } finally {
      setEnviando(false)
    }
  }

  return { enviando, error, setError, enviar }
}
