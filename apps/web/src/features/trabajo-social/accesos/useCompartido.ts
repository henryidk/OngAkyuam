import { useCallback, useEffect, useState } from 'react'
import type { CompartidoArea } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerCompartido } from '../api/trabajoSocial.api'

/** Lo que cada área publicó hacia Trabajo Social sobre un caso. Solo lectura. */
export function useCompartido(expedienteId: string) {
  const [areas, setAreas] = useState<CompartidoArea[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setError(null)
    try {
      setAreas(await obtenerCompartido(expedienteId))
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [expedienteId])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { areas, error, recargar }
}
