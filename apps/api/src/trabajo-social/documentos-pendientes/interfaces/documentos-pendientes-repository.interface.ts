import type { TipoDocumento } from '@prisma/client';

export const DOCUMENTOS_PENDIENTES_REPOSITORY = Symbol(
  'DOCUMENTOS_PENDIENTES_REPOSITORY',
);

/**
 * Cuánto tiempo puede esperar un escaneo subido en el paso "Documentos" a que se registre el
 * caso. Pasado este plazo ya no se puede adjuntar, y la limpieza lo borra (con un margen extra,
 * ver `LimpiezaDocumentosPendientesService`) — así nunca se borra uno que se está adjuntando.
 */
export const VIDA_UTIL_DOCUMENTO_PENDIENTE_MS = 24 * 60 * 60 * 1000;

export interface CrearDocumentoPendienteParams {
  tipo: TipoDocumento;
  nombreArchivo: string;
  claveR2: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
}

export interface DocumentoPendienteCreado {
  id: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  tamanioBytes: number;
}

export interface DocumentoPendienteVencido {
  id: string;
  claveR2: string;
}

export interface IDocumentosPendientesRepository {
  crear(
    params: CrearDocumentoPendienteParams,
  ): Promise<DocumentoPendienteCreado>;
  /**
   * Borra la fila solo si la subió `subidoPorId` y devuelve su clave en R2; `null` si no existe
   * o es de otra persona (el caller responde 404 en ambos casos, sin distinguir).
   */
  eliminarDeUsuario(id: string, subidoPorId: string): Promise<string | null>;
  /** Los más antiguos primero, subidos antes de `limite`. */
  listarVencidos(
    limite: Date,
    maximo: number,
  ): Promise<DocumentoPendienteVencido[]>;
  eliminar(id: string): Promise<void>;
}
