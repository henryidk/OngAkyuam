import { useCallback, useEffect, useState } from 'react'
import type { TableroPsicologia } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerTablero } from '../api/psicologia.api'

export function useTableroDia() {
  const [tablero, setTablero] = useState<TableroPsicologia | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setTablero(null)
    setError(null)
    try {
      setTablero(await obtenerTablero())
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return { tablero, error, recargar }
}
