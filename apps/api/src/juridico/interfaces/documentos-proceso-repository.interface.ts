import type { DocumentoProcesoDto } from '@akyuam/shared';

export const DOCUMENTOS_PROCESO_REPOSITORY = Symbol(
  'DOCUMENTOS_PROCESO_REPOSITORY',
);

export interface CrearDocumentoProcesoParams {
  procesoId: string;
  nombreVisible: string;
  nombreArchivo: string;
  claveR2: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
}

export interface DocumentoParaDescarga {
  claveR2: string;
  nombreVisible: string;
}

// Interfaz chica y específica (ISP): solo persistencia de DocumentoProceso, nada de notas
// ni de reglas de acceso al expediente (eso vive en IProcesosJuridicosRepository).
export interface IDocumentosProcesoRepository {
  crear(params: CrearDocumentoProcesoParams): Promise<DocumentoProcesoDto>;
  listarPorProceso(procesoId: string): Promise<DocumentoProcesoDto[]>;
  /** `null` tanto si el documento no existe como si existe pero no pertenece a `procesoId` — sin IDOR. */
  buscarParaDescarga(
    documentoId: string,
    procesoId: string,
  ): Promise<DocumentoParaDescarga | null>;
}
