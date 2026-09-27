import type {
  DocumentosCaso,
  DocumentoSubido,
  TipoDocumentoTrabajoSocial,
  VersionDocumento,
} from '@akyuam/shared'
import { api } from '../../../lib/api'

/** Cliente tipado del módulo de Trabajo Social — una función por endpoint, nunca `api.get` suelto en un componente. */

function rutaDocumentos(expedienteId: string) {
  return `/trabajo-social/expedientes/${expedienteId}/documentos`
}

export function listarDocumentosCaso(expedienteId: string) {
  return api.get<DocumentosCaso>(rutaDocumentos(expedienteId)).then((res) => res.data)
}

/** La visibilidad por área no se decide al subir: se define al referir (plan §5.3). */
export function subirDocumentoCaso(expedienteId: string, tipo: TipoDocumentoTrabajoSocial, archivo: File) {
  const formData = new FormData()
  formData.append('archivo', archivo)
  formData.append('tipo', tipo)
  formData.append('areasVisibles', JSON.stringify([]))
  return api.post<DocumentoSubido>(rutaDocumentos(expedienteId), formData).then((res) => res.data)
}

export function subirVersionDocumento(expedienteId: string, documentoId: string, archivo: File) {
  const formData = new FormData()
  formData.append('archivo', archivo)
  return api
    .post<DocumentoSubido>(`${rutaDocumentos(expedienteId)}/${documentoId}/versiones`, formData)
    .then((res) => res.data)
}

export function listarVersionesDocumento(expedienteId: string, documentoId: string) {
  return api
    .get<VersionDocumento[]>(`${rutaDocumentos(expedienteId)}/${documentoId}/versiones`)
    .then((res) => res.data)
}

/** URL firmada de corta duración: `inline` para la vista previa, si no, descarga. */
export function obtenerUrlDocumento(expedienteId: string, documentoId: string, inline: boolean) {
  return api
    .get<{ url: string }>(`${rutaDocumentos(expedienteId)}/${documentoId}/url`, { params: { inline } })
    .then((res) => res.data.url)
}
