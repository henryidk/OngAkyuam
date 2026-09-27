import type { Rol, TipoDocumento, TipoRegistro } from '@prisma/client';
import type { VersionDocumento } from '@akyuam/shared';

export const DOCUMENTOS_REPOSITORY = Symbol('DOCUMENTOS_REPOSITORY');

/** La versión que se quería reemplazar ya no es la vigente (otra persona la actualizó antes). */
export class DocumentoYaReemplazadoError extends Error {
  constructor() {
    super('Este documento ya fue reemplazado por una versión más reciente');
  }
}

export interface ExpedienteParaDocumento {
  numero: string;
  tipoRegistro: TipoRegistro;
  tieneEgresoAlbergue: boolean;
  areasReferidas: Rol[];
}

export interface ArchivoDocumento {
  nombreArchivo: string;
  claveR2: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
}

export interface CrearDocumentoParams extends ArchivoDocumento {
  expedienteId: string;
  tipo: TipoDocumento;
  areasVisibles: Rol[];
}

export interface CrearVersionParams extends ArchivoDocumento {
  anterior: DocumentoParaVersionar;
}

export interface DocumentoCreado {
  id: string;
  tipo: TipoDocumento;
  version: number;
  nombreArchivo: string;
  tamanioBytes: number;
  createdAt: Date;
}

export interface DocumentoParaVersionar {
  id: string;
  expedienteId: string;
  tipo: TipoDocumento;
  version: number;
  vigente: boolean;
}

export interface DocumentoVigente extends VersionDocumento {
  tipo: TipoDocumento;
  areasVisibles: Rol[];
}

export interface DocumentoParaDescarga {
  claveR2: string;
  nombreArchivo: string;
  mimeType: string;
}

export interface IDocumentosRepository {
  buscarExpediente(
    expedienteId: string,
  ): Promise<ExpedienteParaDocumento | null>;
  existeVigente(expedienteId: string, tipo: TipoDocumento): Promise<boolean>;
  crear(params: CrearDocumentoParams): Promise<DocumentoCreado>;
  buscarParaVersionar(
    documentoId: string,
    expedienteId: string,
  ): Promise<DocumentoParaVersionar | null>;
  /** Marca `anterior` como no vigente, crea la versión siguiente y le copia la visibilidad, en
   * una sola transacción. Lanza `DocumentoYaReemplazadoError` si `anterior` ya no es vigente. */
  crearVersion(params: CrearVersionParams): Promise<DocumentoCreado>;
  listarVigentes(expedienteId: string): Promise<DocumentoVigente[]>;
  /** Todas las versiones del mismo tipo en el mismo caso, más reciente primero. `null` si el
   * documento no pertenece a ese expediente. */
  listarVersiones(
    documentoId: string,
    expedienteId: string,
  ): Promise<VersionDocumento[] | null>;
  /** Trabajo social ve cualquier documento que haya subido — sin filtro de área (a diferencia
   * de `AreasRepository.buscarDocumentoVisible`, que sí filtra por visibilidad otorgada). */
  buscarParaDescarga(
    documentoId: string,
    expedienteId: string,
  ): Promise<DocumentoParaDescarga | null>;
}
