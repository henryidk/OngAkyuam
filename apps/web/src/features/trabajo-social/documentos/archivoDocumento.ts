import { fechaCalendarioGT, formatFechaGT, type VersionDocumento } from '@akyuam/shared'

// Lo genérico vive en `lib/documentos` porque también lo usa Jurídico; aquí queda solo lo que
// depende de las versiones de documento de Trabajo Social.
export {
  ACCEPT_DOCUMENTOS,
  dispararDescarga,
  esImagen,
  etiquetaFormato,
  formatearTamanio,
  validarArchivoDocumento,
} from '../../../lib/documentos/archivoDocumento'

/** "15/09/2026 · Nombre Apellido" — la fecha es el día en Guatemala, no en UTC. */
export function metaVersion(version: VersionDocumento): string {
  return `${formatFechaGT(fechaCalendarioGT(new Date(version.createdAt)))} · ${version.subidoPor}`
}
