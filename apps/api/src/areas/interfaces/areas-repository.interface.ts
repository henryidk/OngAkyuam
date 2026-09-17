import type { Rol } from '@prisma/client';
import type {
  ExpedienteDetalleArea,
  ExpedienteResumenArea,
} from '@akyuam/shared';

export const AREAS_REPOSITORY = Symbol('AREAS_REPOSITORY');

export interface DocumentoParaDescargaArea {
  claveR2: string;
  nombreArchivo: string;
}

export interface IAreasRepository {
  listarPorArea(area: Rol): Promise<ExpedienteResumenArea[]>;
  /** `null` tanto si el expediente no existe como si existe pero no fue referido a `area`. */
  buscarConAcceso(
    expedienteId: string,
    area: Rol,
  ): Promise<ExpedienteDetalleArea | null>;
  /**
   * `null` si el documento no existe, no pertenece a `expedienteId`, o no tiene
   * visibilidad otorgada para `area` — mismo criterio uniforme, sin distinguir el caso.
   */
  buscarDocumentoVisible(
    documentoId: string,
    expedienteId: string,
    area: Rol,
  ): Promise<DocumentoParaDescargaArea | null>;
}
