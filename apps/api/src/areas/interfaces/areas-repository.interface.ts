import type { Rol } from '@prisma/client';
import type {
  ExpedienteDetalleArea,
  ExpedienteResumenArea,
} from '@akyuam/shared';

export const AREAS_REPOSITORY = Symbol('AREAS_REPOSITORY');

export interface IAreasRepository {
  listarPorArea(area: Rol): Promise<ExpedienteResumenArea[]>;
  /** `null` tanto si el expediente no existe como si existe pero no fue referido a `area`. */
  buscarConAcceso(
    expedienteId: string,
    area: Rol,
  ): Promise<ExpedienteDetalleArea | null>;
}
