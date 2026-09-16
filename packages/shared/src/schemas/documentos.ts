import { z } from 'zod'
import { AREAS_ATENCION } from '../catalogos/registroUsuaria.js'
import { DOCUMENTOS_MIME_PERMITIDOS, TIPOS_DOCUMENTO } from '../catalogos/documentos.js'

export const tipoDocumentoSchema = z.enum(TIPOS_DOCUMENTO)
export type TipoDocumento = z.infer<typeof tipoDocumentoSchema>

/**
 * Contrato de los campos de `multipart/form-data` de `POST .../documentos` (el archivo en sí
 * viaja aparte, como binario, no dentro de este schema). `areasVisibles` llega como string JSON
 * porque los campos de un `FormData` son siempre texto — se parsea antes de validar contra esto.
 */
export const subirDocumentoSchema = z.object({
  tipo: tipoDocumentoSchema,
  areasVisibles: z.array(z.enum(AREAS_ATENCION)),
})
export type SubirDocumentoInput = z.infer<typeof subirDocumentoSchema>

/** Respuesta de `POST .../documentos` — nunca incluye la clave real del objeto en R2. */
export interface DocumentoSubido {
  id: string
  tipo: TipoDocumento
  nombreArchivo: string
  tamanioBytes: number
  createdAt: string
}

export function mimeTypePermitido(mimeType: string): boolean {
  return (DOCUMENTOS_MIME_PERMITIDOS as readonly string[]).includes(mimeType)
}
