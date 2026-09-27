import { useCallback, useEffect, useState } from 'react'
import type { ExpedienteResumenPsicologia } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerResumenExpediente } from '../api/psicologia.api'

export function useExpedientePsicologia(expedienteId: string) {
  const [resumen, setResumen] = useState<ExpedienteResumenPsicologia | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setResumen(null)
    setError(null)
    try {
      setResumen(await obtenerResumenExpediente(expedienteId))
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [expedienteId])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { resumen, error, recargar }
}
