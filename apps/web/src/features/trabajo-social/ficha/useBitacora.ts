import { useEffect, useState } from 'react'
import type { EventoBitacora } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerBitacora } from '../api/trabajoSocial.api'

/** Bitácora de la usuaria; `version` la vuelve a pedir tras un cambio hecho desde la ficha. */
export function useBitacora(usuariaId: string, version: number) {
  const [eventos, setEventos] = useState<EventoBitacora[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    setError(null)
    obtenerBitacora(usuariaId)
      .then((datos) => {
        if (!cancelado) setEventos(datos)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [usuariaId, version])

  return { eventos, error }
}
