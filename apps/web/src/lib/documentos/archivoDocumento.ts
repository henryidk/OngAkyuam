import { DOCUMENTO_TAMANIO_MAXIMO_BYTES, DOCUMENTOS_MIME_PERMITIDOS, mimeTypePermitido } from '@akyuam/shared'

/** Utilidades de archivos compartidas por las áreas que suben documentos (Trabajo Social y Jurídico). */

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

/** Descarga sin abrir pestaña nueva: la URL firmada ya trae `Content-Disposition: attachment`. */
export function dispararDescarga(url: string): void {
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.rel = 'noopener noreferrer'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
}
