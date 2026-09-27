import { useEffect, useState } from 'react'
import type { VersionDocumento } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { listarVersionesDocumento, obtenerUrlDocumento } from '../api/trabajoSocial.api'

/**
 * Historial de versiones y URL de vista previa del documento vigente. La URL firmada dura
 * pocos minutos, por eso se pide al abrir el drawer y no se guarda en la lista de filas.
 */
export function useVersionesDocumento(expedienteId: string, documentoId: string | null) {
  const [versiones, setVersiones] = useState<VersionDocumento[] | null>(null)
  const [urlVistaPrevia, setUrlVistaPrevia] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setVersiones(null)
    setUrlVistaPrevia(null)
    setError(null)
    if (!documentoId) return

    let cancelado = false
    Promise.all([
      listarVersionesDocumento(expedienteId, documentoId),
      obtenerUrlDocumento(expedienteId, documentoId, true),
    ])
      .then(([lista, url]) => {
        if (cancelado) return
        setVersiones(lista)
        setUrlVistaPrevia(url)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [expedienteId, documentoId])

  return { versiones, urlVistaPrevia, error }
}
