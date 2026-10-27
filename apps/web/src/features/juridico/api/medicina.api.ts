import type { UrlDocumentoMedicoQuery, VistaMedicaParaJuridico } from '@akyuam/shared'
import { api } from '../../../lib/api'

/** Lo que Medicina compartió con Jurídico sobre esta usuaria (vacío si no compartió nada). */
export function obtenerMedicinaCompartida(usuariaId: string) {
  return api.get<VistaMedicaParaJuridico[]>(`/juridico/usuarias/${usuariaId}/medicina`).then((res) => res.data)
}

/** URL firmada de corta duración de un documento médico compartido. */
export function obtenerUrlDocumentoMedico(usuariaId: string, documentoId: string, modo: UrlDocumentoMedicoQuery['modo']) {
  return api
    .get<{ url: string }>(`/juridico/usuarias/${usuariaId}/medicina/documentos/${documentoId}/url`, { params: { modo } })
    .then((res) => res.data.url)
}
