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

export interface IDocumentosRepository {
  buscarExpedienteParaSubida(
    expedienteId: string,
  ): Promise<ExpedienteParaDocumento | null>;
  crear(params: CrearDocumentoParams): Promise<DocumentoCreado>;
}
