import { useCallback, useMemo, useState } from 'react'
import { DOCUMENTO_TAMANIO_MAXIMO_BYTES, mimeTypePermitido, type TipoDocumentoTrabajoSocial } from '@akyuam/shared'

/**
 * Un archivo elegido en el paso "Documentos". Sin visibilidad por área: todo documento nace
 * privado para Trabajo Social y se comparte después, al referir o desde la pestaña Accesos.
 */
export interface DocumentoStaging {
  tipo: TipoDocumentoTrabajoSocial
  archivo: File
  error?: string
}

export type EstadoSubidaDocumento = 'subiendo' | 'ok' | 'error'

export interface DocumentoEnSubida extends DocumentoStaging {
  estado: EstadoSubidaDocumento
  mensajeError?: string
}

type DocumentosPorTipo = Partial<Record<TipoDocumentoTrabajoSocial, DocumentoStaging>>

/**
 * Mantiene en memoria los archivos elegidos en el paso "Documentos" mientras el expediente
 * todavía no existe (no se sube nada aquí). Separado de la orquestación del wizard: este hook
 * solo sabe de "qué archivos están listos para subir", no de en qué paso está el usuario.
 */
export function useDocumentosStaging() {
  const [documentosPorTipo, setDocumentosPorTipo] = useState<DocumentosPorTipo>({})

  const seleccionarArchivo = useCallback((tipo: TipoDocumentoTrabajoSocial, archivo: File) => {
    const error = validarArchivo(archivo)
    setDocumentosPorTipo((actual) => ({ ...actual, [tipo]: { tipo, archivo, error } }))
  }, [])

  const quitarArchivo = useCallback((tipo: TipoDocumentoTrabajoSocial) => {
    setDocumentosPorTipo((actual) => {
      const { [tipo]: _quitado, ...resto } = actual
      return resto
    })
  }, [])

  const documentos = useMemo(() => Object.values(documentosPorTipo), [documentosPorTipo])

  return { documentosPorTipo, documentos, seleccionarArchivo, quitarArchivo }
}

export type UseDocumentosStaging = ReturnType<typeof useDocumentosStaging>

function validarArchivo(archivo: File): string | undefined {
  if (!mimeTypePermitido(archivo.type)) {
    return 'Tipo de archivo no permitido. Usa PDF, JPG, PNG o WEBP.'
  }
  if (archivo.size > DOCUMENTO_TAMANIO_MAXIMO_BYTES) {
    return 'El archivo supera el tamaño máximo permitido (15 MB).'
  }
  return undefined
}
