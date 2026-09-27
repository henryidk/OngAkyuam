import { useCallback, useState } from 'react'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerUrlDocumento } from '../api/trabajoSocial.api'
import { dispararDescarga } from './archivoDocumento'

export function useDescargaDocumento(expedienteId: string) {
  const [descargandoId, setDescargandoId] = useState<string | null>(null)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  const descargar = useCallback(
    async (documentoId: string) => {
      setErrorDescarga(null)
      setDescargandoId(documentoId)
      try {
        dispararDescarga(await obtenerUrlDocumento(expedienteId, documentoId, false))
      } catch (err) {
        setErrorDescarga(extraerMensajeError(err))
      } finally {
        setDescargandoId(null)
      }
    },
    [expedienteId],
  )

  return { descargar, descargandoId, errorDescarga }
}
