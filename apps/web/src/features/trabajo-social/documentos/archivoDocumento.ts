import {
  DOCUMENTO_TAMANIO_MAXIMO_BYTES,
  DOCUMENTOS_MIME_PERMITIDOS,
  fechaCalendarioGT,
  formatFechaGT,
  mimeTypePermitido,
  type VersionDocumento,
} from '@akyuam/shared'

export const ACCEPT_DOCUMENTOS = DOCUMENTOS_MIME_PERMITIDOS.join(',')

/** Mismo criterio que el backend, para avisar antes de subir 15 MB que el servidor rechazaría. */
export function validarArchivoDocumento(archivo: File): string | null {
  if (!mimeTypePermitido(archivo.type)) {
    return 'Solo se aceptan archivos PDF, JPG, PNG o WEBP.'
  }
  if (archivo.size > DOCUMENTO_TAMANIO_MAXIMO_BYTES) {
    return 'El archivo supera el máximo de 15 MB.'
  }
  return null
}

export function formatearTamanio(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function esImagen(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function etiquetaFormato(mimeType: string | undefined): string {
  return mimeType && esImagen(mimeType) ? 'IMG' : 'PDF'
}

/** "15/09/2026 · Nombre Apellido" — la fecha es el día en Guatemala, no en UTC. */
export function metaVersion(version: VersionDocumento): string {
  return `${formatFechaGT(fechaCalendarioGT(new Date(version.createdAt)))} · ${version.subidoPor}`
}

/** Descarga sin abrir pestaña nueva: la URL firmada ya trae `Content-Disposition: attachment`. */
export function dispararDescarga(url: string): void {
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.rel = 'noopener noreferrer'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
}
