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
  /**
   * La carpeta del proceso con ese nombre (sin distinguir mayúsculas), creándola si todavía no
   * existe. Devuelve su id. Si alguien ya creó a mano una carpeta con ese nombre, se reutiliza.
   */
  obtenerOCrear(params: CrearCarpetaParams): Promise<string>;
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
  /** Documento propio de una audiencia del mismo proceso (acta, citación). */
  audienciaId: string | null;
  /** Documento adjunto a una actuación de la bitácora del mismo proceso. */
  actuacionId: string | null;
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

export interface DocumentoParaReemplazo {
  claveR2: string;
  carpetaId: string;
  audienciaId: string | null;
  actuacionId: string | null;
}

export interface ReemplazarArchivoParams {
  documentoId: string;
  procesoId: string;
  /** Clave que tenía al leerlo: si ya cambió, otra persona lo reemplazó mientras tanto. */
  claveAnterior: string;
  claveR2: string;
  nombreArchivo: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
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
  /** `null` si el documento no existe o no es de ese proceso. */
  buscarParaReemplazo(
    documentoId: string,
    procesoId: string,
  ): Promise<DocumentoParaReemplazo | null>;
  /**
   * Cambia el archivo del documento conservando su id, nombre visible, carpeta y enlaces
   * (audiencia o actuación). `null` si el documento ya no tiene `claveAnterior`.
   */
  reemplazarArchivo(
    params: ReemplazarArchivoParams,
  ): Promise<DocumentoProcesoDto | null>;
}
