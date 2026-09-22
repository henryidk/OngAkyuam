import type { Rol, TipoDocumento, TipoRegistro } from '@prisma/client';

export const DOCUMENTOS_REPOSITORY = Symbol('DOCUMENTOS_REPOSITORY');

export interface ExpedienteParaDocumento {
  tipoRegistro: TipoRegistro;
  areasReferidas: Rol[];
}

export interface CrearDocumentoParams {
  expedienteId: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  claveR2: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
  areasVisibles: Rol[];
}

export interface DocumentoCreado {
  id: string;
  tipo: TipoDocumento;
  nombreArchivo: string;
  tamanioBytes: number;
  createdAt: Date;
}

export interface DocumentoParaDescarga {
  claveR2: string;
  nombreArchivo: string;
}

export interface IDocumentosRepository {
  buscarExpedienteParaSubida(
    expedienteId: string,
  ): Promise<ExpedienteParaDocumento | null>;
  crear(params: CrearDocumentoParams): Promise<DocumentoCreado>;
  /** Trabajo social ve cualquier documento que haya subido — sin filtro de área (a diferencia
   * de `AreasRepository.buscarDocumentoVisible`, que sí filtra por visibilidad otorgada). */
  buscarParaDescarga(
    documentoId: string,
    expedienteId: string,
  ): Promise<DocumentoParaDescarga | null>;
}
