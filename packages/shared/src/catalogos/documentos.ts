export const TIPOS_DOCUMENTO = ['ENTREVISTA_USUARIA', 'CONVENIO_INGRESO', 'RECEPCION_BIENES'] as const

export const ETIQUETAS_TIPO_DOCUMENTO: Record<(typeof TIPOS_DOCUMENTO)[number], string> = {
  ENTREVISTA_USUARIA: 'Entrevista a usuaria',
  CONVENIO_INGRESO: 'Convenio de ingreso',
  RECEPCION_BIENES: 'Documento de recepción de bienes',
}

/** Documentos que solo aplican cuando el registro es Interna (solicita albergue). */
export const TIPOS_DOCUMENTO_ALBERGUE = ['CONVENIO_INGRESO', 'RECEPCION_BIENES'] as const

/**
 * Lista blanca de MIME permitidos al subir un documento — única fuente de verdad usada
 * tanto por la validación del `<input type="file">` en el navegador (feedback inmediato)
 * como por la validación real del lado del servidor.
 */
export const DOCUMENTOS_MIME_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const DOCUMENTO_TAMANIO_MAXIMO_BYTES = 15 * 1024 * 1024 // 15 MB
