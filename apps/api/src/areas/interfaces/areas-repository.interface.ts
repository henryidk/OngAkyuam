import type { Rol } from '@prisma/client';
import type {
  DatosCasoArea,
  DocumentoVisibleArea,
  ExpedienteDetalleArea,
  ExpedienteResumenArea,
} from '@akyuam/shared';
import type {
  DocumentoConVisibilidad,
  ReferidoParaPolitica,
} from '../politicas/politica-acceso-area.interface';

export const AREAS_REPOSITORY = Symbol('AREAS_REPOSITORY');

export type DocumentoAreaSinFiltrar = DocumentoVisibleArea &
  DocumentoConVisibilidad;

/**
 * Expediente referido al área, **antes** de aplicar la política de acceso: trae todo lo que la
 * política necesita para decidir (el referido y la visibilidad de cada documento). Solo
 * `AreasService` lo recibe, y nunca sale así hacia el cliente.
 */
export interface ExpedienteReferidoArea extends Omit<
  ExpedienteDetalleArea,
  'datosCaso' | 'documentos'
> {
  referido: ReferidoParaPolitica;
  datosCaso: DatosCasoArea;
  documentos: DocumentoAreaSinFiltrar[];
}

export interface DocumentoParaDescargaArea extends DocumentoConVisibilidad {
  claveR2: string;
  nombreArchivo: string;
  mimeType: string;
}

export interface IAreasRepository {
  listarPorArea(area: Rol): Promise<ExpedienteResumenArea[]>;
  /** `null` tanto si el expediente no existe como si existe pero no fue referido a `area`. */
  buscarReferido(
    expedienteId: string,
    area: Rol,
  ): Promise<ExpedienteReferidoArea | null>;
  /**
   * Documento vigente de un expediente referido a `area`. `null` si el documento no existe, no
   * pertenece a `expedienteId`, no es vigente o el expediente no fue referido a `area` — mismo
   * criterio uniforme, sin distinguir el caso. La visibilidad la decide la política, no esto.
   */
  buscarDocumentoDeReferido(
    documentoId: string,
    expedienteId: string,
    area: Rol,
  ): Promise<DocumentoParaDescargaArea | null>;
}
