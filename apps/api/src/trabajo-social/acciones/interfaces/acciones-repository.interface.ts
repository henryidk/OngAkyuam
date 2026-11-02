import type { AccionTrabajoSocialDto } from '@akyuam/shared';

export const ACCIONES_REPOSITORY = Symbol('ACCIONES_REPOSITORY');

export interface RegistrarAccionParams {
  expedienteId: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  descripcion: string;
  registradaPorId: string;
}

/** Bitácora de atención brindada por Trabajo Social en un caso. */
export interface IAccionesRepository {
  existeExpediente(expedienteId: string): Promise<boolean>;
  /** Más reciente primero (por fecha y luego por registro). */
  listar(expedienteId: string): Promise<AccionTrabajoSocialDto[]>;
  registrar(params: RegistrarAccionParams): Promise<AccionTrabajoSocialDto>;
}
