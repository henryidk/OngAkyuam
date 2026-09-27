import { useCallback, useEffect, useState } from 'react'
import type { DocumentosCaso, FilaDocumentoCaso } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { listarDocumentosCaso, subirDocumentoCaso, subirVersionDocumento } from '../api/trabajoSocial.api'
import { validarArchivoDocumento } from './archivoDocumento'

/**
 * Filas de la pestaña Documentos y las dos escrituras posibles: subir el primer escaneo de un
 * formulario o reemplazar el vigente por una versión nueva (el backend decide cuál aplica).
 */
export function useDocumentosCaso(expedienteId: string) {
  const [documentos, setDocumentos] = useState<DocumentosCaso | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tipoEnSubida, setTipoEnSubida] = useState<FilaDocumentoCaso['tipo'] | null>(null)
  const [errorSubida, setErrorSubida] = useState<string | null>(null)

  const recargar = useCallback(async () => {
    setError(null)
    try {
      setDocumentos(await listarDocumentosCaso(expedienteId))
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [expedienteId])

  useEffect(() => {
    setDocumentos(null)
    void recargar()
  }, [recargar])

  /** Devuelve `true` si se subió, para que quien llama (p. ej. el drawer) refresque lo suyo. */
  const subirArchivo = useCallback(
    async (fila: FilaDocumentoCaso, archivo: File): Promise<boolean> => {
      const invalido = validarArchivoDocumento(archivo)
      if (invalido) {
        setErrorSubida(invalido)
        return false
      }
      setErrorSubida(null)
      setTipoEnSubida(fila.tipo)
      try {
        if (fila.vigente) {
          await subirVersionDocumento(expedienteId, fila.vigente.id, archivo)
        } else {
          await subirDocumentoCaso(expedienteId, fila.tipo, archivo)
        }
        await recargar()
        return true
      } catch (err) {
        setErrorSubida(extraerMensajeError(err))
        return false
      } finally {
        setTipoEnSubida(null)
      }
    },
    [expedienteId, recargar],
  )

  return { documentos, error, recargar, subirArchivo, tipoEnSubida, errorSubida }
}
