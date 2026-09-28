import { useCallback, useEffect, useState } from 'react'
import type { UsuariaExpedienteHub } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerUsuaria } from '../api/trabajoSocial.api'

/** Identidad, casos y estado derivado de la usuaria — lo comparten el encabezado y todas las pestañas. */
export function useFichaUsuaria(usuariaId: string) {
  const [usuaria, setUsuaria] = useState<UsuariaExpedienteHub | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    try {
      setUsuaria(await obtenerUsuaria(usuariaId))
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [usuariaId])

  useEffect(() => {
    setUsuaria(null)
    setError(null)
    void recargar()
  }, [recargar])

  return { usuaria, setUsuaria, error, recargar }
}
