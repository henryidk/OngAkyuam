import { z } from 'zod'
import { AREAS_ATENCION, ETIQUETAS_AREA_ATENCION } from '../catalogos/registroUsuaria.js'
import {
  DOCUMENTOS_MIME_PERMITIDOS,
  TIPOS_DOCUMENTO,
  TIPOS_DOCUMENTO_TRABAJO_SOCIAL,
} from '../catalogos/documentos.js'
import { booleanoQuerySchema } from './query.js'

export const tipoDocumentoSchema = z.enum(TIPOS_DOCUMENTO)
export type TipoDocumento = z.infer<typeof tipoDocumentoSchema>

export const tipoDocumentoTrabajoSocialSchema = z.enum(TIPOS_DOCUMENTO_TRABAJO_SOCIAL)
export type TipoDocumentoTrabajoSocial = z.infer<typeof tipoDocumentoTrabajoSocialSchema>

/**
 * Contrato de los campos de `multipart/form-data` de `POST .../documentos` (el archivo en sí
 * viaja aparte, como binario, no dentro de este schema). `areasVisibles` llega como string JSON
 * porque los campos de un `FormData` son siempre texto — se parsea antes de validar contra esto.
 */
export const subirDocumentoSchema = z.object({
  tipo: tipoDocumentoTrabajoSocialSchema,
  areasVisibles: z.array(z.enum(AREAS_ATENCION)),
})
export type SubirDocumentoInput = z.infer<typeof subirDocumentoSchema>

/** `GET .../documentos/:documentoId/url?inline=true` — `inline` para la vista previa del drawer. */
export const urlDocumentoQuerySchema = z.object({
  inline: booleanoQuerySchema.default(false),
})
export type UrlDocumentoQuery = z.infer<typeof urlDocumentoQuerySchema>

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

/** Una versión de un documento — `GET .../documentos/:documentoId/versiones` (más reciente primero). */
export interface VersionDocumento {
  id: string
  version: number
  vigente: boolean
  nombreArchivo: string
  mimeType: string
  tamanioBytes: number
  createdAt: string
  subidoPor: string
}

/**
 * - `SUBIDO`: tiene versión vigente.
 * - `FALTANTE`: aplica al caso y aún no tiene escaneo.
 * - `AUN_NO_APLICA`: convenio de egreso de una usuaria que sigue en el albergue.
 */
export type EstadoDocumentoCaso = 'SUBIDO' | 'FALTANTE' | 'AUN_NO_APLICA'

/** Una fila de la pestaña Documentos: un tipo de formulario y su versión vigente, si existe. */
export interface FilaDocumentoCaso {
  tipo: TipoDocumentoTrabajoSocial
  estado: EstadoDocumentoCaso
  requerido: boolean
  vigente: VersionDocumento | null
  areasVisibles: (typeof AREAS_ATENCION)[number][]
}

/** `GET /trabajo-social/expedientes/:id/documentos` — filas ya calculadas por el backend. */
export interface DocumentosCaso {
  expedienteId: string
  numero: string
  filas: FilaDocumentoCaso[]
}

/** Texto de la columna "Visible para": Trabajo Social siempre ve todo lo que subió. */
export function textoVisiblePara(areasVisibles: readonly (typeof AREAS_ATENCION)[number][]): string {
  if (areasVisibles.length === 0) {
    return 'Solo Trabajo Social'
  }
  return ['Trabajo Social', ...areasVisibles.map((area) => ETIQUETAS_AREA_ATENCION[area])].join(', ')
}
