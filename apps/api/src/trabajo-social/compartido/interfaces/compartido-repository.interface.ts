import type {
  FaseProcesoJuridico,
  SituacionProcesoJuridico,
  Rol,
  TipoProcesoJuridico,
} from '@prisma/client';

export const COMPARTIDO_REPOSITORY = Symbol('COMPARTIDO_REPOSITORY');

export interface ProcesoJuridicoCompartido {
  tipo: TipoProcesoJuridico;
  fase: FaseProcesoJuridico;
  situacion: SituacionProcesoJuridico;
  abogada: string | null;
  procuradora: string | null;
}

/**
 * Lecturas mínimas de lo que cada área publica hacia Trabajo Social. Cada método selecciona
 * solo las columnas que se comparten: lo que no está aquí no puede filtrarse por descuido.
 */
export interface ICompartidoRepository {
  /** Áreas a las que se refirió el caso; `null` si el expediente no existe. */
  areasReferidas(expedienteId: string): Promise<Rol[] | null>;
  procesosJuridicos(expedienteId: string): Promise<ProcesoJuridicoCompartido[]>;
  /** Solo la fecha y hora de la próxima cita programada — nunca contenido clínico. */
  proximaCitaPsicologica(expedienteId: string): Promise<Date | null>;
}
