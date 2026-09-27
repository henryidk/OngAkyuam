import { useCallback, useEffect, useState } from 'react'
import type { AgendaCita } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { listarAgenda } from '../api/psicologia.api'

export function useAgendaRango(desde: string, hasta: string) {
  const [citas, setCitas] = useState<AgendaCita[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setCitas(null)
    setError(null)
    try {
      setCitas(await listarAgenda({ desde, hasta }))
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [desde, hasta])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { citas, error, recargar }
}
