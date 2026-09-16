import { useCallback, useMemo, useState } from 'react'
import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  mimeTypePermitido,
  type AreaAtencion,
  type TipoDocumento,
} from '@akyuam/shared'

export interface DocumentoStaging {
  tipo: TipoDocumento
  archivo: File
  areasVisibles: AreaAtencion[]
  error?: string
}

type DocumentosPorTipo = Partial<Record<TipoDocumento, DocumentoStaging>>

/**
 * Mantiene en memoria los archivos elegidos en el paso "Documentos" mientras el expediente
 * todavía no existe (no se sube nada aquí). Separado de la orquestación del wizard: este hook
 * solo sabe de "qué archivos están listos para subir", no de en qué paso está el usuario.
 */
export function useDocumentosStaging() {
  const [documentosPorTipo, setDocumentosPorTipo] = useState<DocumentosPorTipo>({})

  const seleccionarArchivo = useCallback((tipo: TipoDocumento, archivo: File) => {
    const error = validarArchivo(archivo)
    setDocumentosPorTipo((actual) => ({
      ...actual,
      [tipo]: { tipo, archivo, areasVisibles: [], error },
    }))
  }, [])

  const quitarArchivo = useCallback((tipo: TipoDocumento) => {
    setDocumentosPorTipo((actual) => {
      const { [tipo]: _quitado, ...resto } = actual
      return resto
    })
  }, [])

  const alternarAreaVisible = useCallback((tipo: TipoDocumento, area: AreaAtencion) => {
    setDocumentosPorTipo((actual) => {
      const documento = actual[tipo]
      if (!documento) return actual
      const yaIncluida = documento.areasVisibles.includes(area)
      const areasVisibles = yaIncluida
        ? documento.areasVisibles.filter((a) => a !== area)
        : [...documento.areasVisibles, area]
      return { ...actual, [tipo]: { ...documento, areasVisibles } }
    })
  }, [])

  const limpiar = useCallback(() => setDocumentosPorTipo({}), [])

  const documentos = useMemo(() => Object.values(documentosPorTipo), [documentosPorTipo])

  return { documentosPorTipo, documentos, seleccionarArchivo, quitarArchivo, alternarAreaVisible, limpiar }
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
