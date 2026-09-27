import type { DocumentoCitaDto } from '@akyuam/shared';

export const DOCUMENTOS_CITA_REPOSITORY = Symbol('DOCUMENTOS_CITA_REPOSITORY');

export interface CrearDocumentoCitaParams {
  citaId: string;
  expedienteId: string;
  nombreArchivo: string;
  claveR2: string;
  mimeType: string;
  tamanioBytes: number;
  subidoPorId: string;
}

export interface DocumentoCitaParaDescarga {
  id: string;
  claveR2: string;
  nombreArchivo: string;
}

/** Documento (Formato General escaneado) de una cita puntual — segregado de las demás
 *  operaciones de cita porque `RegistroConsultaService` es su único consumidor (§7.2). */
export interface IDocumentosCitaRepository {
  crearDocumento(params: CrearDocumentoCitaParams): Promise<DocumentoCitaDto>;
  /** `null` tanto si la cita no tiene documento todavía como si no le pertenece. */
  buscarDocumentoParaDescarga(
    citaId: string,
  ): Promise<DocumentoCitaParaDescarga | null>;
}
