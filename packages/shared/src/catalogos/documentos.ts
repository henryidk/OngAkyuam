import type { TIPOS_REGISTRO } from './registroUsuaria.js'

export const TIPOS_DOCUMENTO = [
  'ENTREVISTA_USUARIA',
  'CONVENIO_INGRESO',
  'RECEPCION_BIENES',
  'FORMATO_ATENCION_PSICOLOGICA',
  'CONVENIO_EGRESO',
  'ACCIONES_REALIZADAS',
] as const

type TipoDocumentoCatalogo = (typeof TIPOS_DOCUMENTO)[number]
type TipoRegistroCatalogo = (typeof TIPOS_REGISTRO)[number]

export const ETIQUETAS_TIPO_DOCUMENTO: Record<TipoDocumentoCatalogo, string> = {
  ENTREVISTA_USUARIA: 'Entrevista a usuaria',
  CONVENIO_INGRESO: 'Convenio de ingreso',
  RECEPCION_BIENES: 'Recepción de bienes',
  FORMATO_ATENCION_PSICOLOGICA: 'Formato general de atención psicológica',
  CONVENIO_EGRESO: 'Convenio de egreso',
  ACCIONES_REALIZADAS: 'Acciones realizadas',
}

/**
 * Formularios en papel que maneja Trabajo Social, en el orden en que se muestran en la
 * pestaña Documentos. Solo estos se versionan (uno vigente por tipo y caso):
 * `FORMATO_ATENCION_PSICOLOGICA` queda fuera porque hay uno por cita y lo sube Psicología.
 */
export const TIPOS_DOCUMENTO_TRABAJO_SOCIAL = [
  'ENTREVISTA_USUARIA',
  'CONVENIO_INGRESO',
  'RECEPCION_BIENES',
  'ACCIONES_REALIZADAS',
  'CONVENIO_EGRESO',
] as const satisfies readonly TipoDocumentoCatalogo[]

/** Documentos sujetos a la matriz de accesos por área (los mismos que gestiona Trabajo Social). */
export const TIPOS_DOCUMENTO_RESTRINGIBLES = TIPOS_DOCUMENTO_TRABAJO_SOCIAL

/** Documentos que solo aplican cuando el registro es Interna (solicita albergue). */
export const TIPOS_DOCUMENTO_ALBERGUE = [
  'CONVENIO_INGRESO',
  'RECEPCION_BIENES',
  'CONVENIO_EGRESO',
] as const satisfies readonly TipoDocumentoCatalogo[]

export function tipoDocumentoAplicaARegistro(
  tipo: TipoDocumentoCatalogo,
  tipoRegistro: TipoRegistroCatalogo,
): boolean {
  return tipoRegistro === 'INTERNA' || !(TIPOS_DOCUMENTO_ALBERGUE as readonly string[]).includes(tipo)
}

/**
 * Documentos que un caso debe tener escaneados — fuente única para la cola "Documentos por
 * subir" de la bandeja, el paso Documentos del wizard y la pestaña Documentos. El convenio de
 * egreso solo se exige una vez registrado el egreso del albergue.
 */
export function documentosRequeridos(
  tipoRegistro: TipoRegistroCatalogo,
  conEgreso: boolean,
): TipoDocumentoCatalogo[] {
  if (tipoRegistro === 'EXTERNA') {
    return ['ENTREVISTA_USUARIA']
  }
  const requeridosInterna: TipoDocumentoCatalogo[] = ['ENTREVISTA_USUARIA', 'CONVENIO_INGRESO', 'RECEPCION_BIENES']
  return conEgreso ? [...requeridosInterna, 'CONVENIO_EGRESO'] : requeridosInterna
}

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
