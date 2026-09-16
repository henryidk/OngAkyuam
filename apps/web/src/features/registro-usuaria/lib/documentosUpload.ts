import type { DocumentoSubido } from '@akyuam/shared'
import { api } from '../../../lib/api'
import type { DocumentoStaging } from '../hooks/useDocumentosStaging'

export type EstadoSubidaDocumento = 'subiendo' | 'ok' | 'error'

export interface DocumentoEnSubida extends DocumentoStaging {
  estado: EstadoSubidaDocumento
  mensajeError?: string
}

export async function subirDocumento(
  expedienteId: string,
  documento: DocumentoStaging,
): Promise<DocumentoSubido> {
  const formData = new FormData()
  formData.append('archivo', documento.archivo)
  formData.append('tipo', documento.tipo)
  formData.append('areasVisibles', JSON.stringify(documento.areasVisibles))

  const { data } = await api.post<DocumentoSubido>(
    `/trabajo-social/expedientes/${expedienteId}/documentos`,
    formData,
  )
  return data
}
