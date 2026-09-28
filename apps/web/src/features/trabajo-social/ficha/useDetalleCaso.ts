import { useEffect, useState } from 'react'
import type { ExpedienteDetalleCaso } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerDetalleExpediente } from '../api/trabajoSocial.api'

/** Detalle de un caso (tipología, agresor, albergue, niñas y niños). `version` fuerza recargar. */
export function useDetalleCaso(expedienteId: string | null, version = 0) {
  const [detalle, setDetalle] = useState<ExpedienteDetalleCaso | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!expedienteId) {
      setDetalle(null)
      return
    }
    let cancelado = false
    setError(null)
    obtenerDetalleExpediente(expedienteId)
      .then((datos) => {
        if (!cancelado) setDetalle(datos)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [expedienteId, version])

  return { detalle: detalle?.id === expedienteId ? detalle : null, error }
}
