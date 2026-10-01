import type { CarpetaDto, DocumentoProcesoDto } from '@akyuam/shared';

export const CARPETAS_REPOSITORY = Symbol('CARPETAS_REPOSITORY');
export const DOCUMENTOS_PROCESO_REPOSITORY = Symbol(
  'DOCUMENTOS_PROCESO_REPOSITORY',
);

export interface CrearCarpetaParams {
  procesoId: string;
  nombre: string;
  creadaPorId: string;
}

export interface RenombrarCarpetaParams {
  carpetaId: string;
  procesoId: string;
  nombre: string;
}

export type ResultadoRenombrarCarpeta =
  'RENOMBRADA' | 'NOMBRE_DUPLICADO' | 'INEXISTENTE';

export interface ICarpetasRepository {
  /** Carpetas del proceso en el orden en que se crearon, cada una con sus documentos. */
  listarConDocumentos(procesoId: string): Promise<CarpetaDto[]>;
  /** `null` si el proceso ya tiene una carpeta con ese nombre (sin distinguir mayúsculas). */
  crear(params: CrearCarpetaParams): Promise<CarpetaDto | null>;
  renombrar(params: RenombrarCarpetaParams): Promise<ResultadoRenombrarCarpeta>;
  /** La carpeta existe **y** es de ese proceso: nunca se busca solo por su id. */
  perteneceAlProceso(carpetaId: string, procesoId: string): Promise<boolean>;
}

export interface CrearDocumentoProcesoParams {
  procesoId: string;
  carpetaId: string;
  nombreVisible: string;
  nombreArchivo: string;
  claveR2: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
}

export interface RenombrarDocumentoParams {
  documentoId: string;
  procesoId: string;
  nombreVisible: string;
}

export interface DocumentoParaUrl {
  claveR2: string;
  nombreVisible: string;
  mimeType: string;
  carpetaId: string;
}

export interface IDocumentosProcesoRepository {
  /** Guarda el documento y marca el proceso como recién trabajado (`ultimaActuacionEn`). */
  crear(params: CrearDocumentoProcesoParams): Promise<DocumentoProcesoDto>;
  /** `null` si el documento no existe o no es de ese proceso. */
  renombrar(
    params: RenombrarDocumentoParams,
  ): Promise<DocumentoProcesoDto | null>;
  /** `null` si el documento no existe o no es de ese proceso. */
  buscarParaUrl(
    documentoId: string,
    procesoId: string,
  ): Promise<DocumentoParaUrl | null>;
}
