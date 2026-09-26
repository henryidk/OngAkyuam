import type {
  AtencionPsicologicaDetalle,
  EstadoAtencionPsicologica,
} from '@akyuam/shared';

export const ATENCION_PSICOLOGICA_REPOSITORY = Symbol(
  'ATENCION_PSICOLOGICA_REPOSITORY',
);

export interface ExpedienteAccesoPsicologia {
  id: string;
}

export interface ObtenerOCrearAtencionParams {
  expedienteId: string;
  creadaPorId: string;
}

export interface ActualizarEstadoAtencionParams {
  expedienteId: string;
  estado: EstadoAtencionPsicologica;
  actualizadoPorId: string;
}

export interface IAtencionPsicologicaRepository {
  /** `null` tanto si el expediente no existe como si existe pero no fue referido a PSICOLOGIA. */
  buscarExpedienteConAcceso(
    expedienteId: string,
  ): Promise<ExpedienteAccesoPsicologia | null>;
  /**
   * Obtiene la atención del expediente o la crea perezosamente (estado INICIO) la primera
   * vez que psicología abre ese expediente — `upsert` en la implementación, nunca dos pasos
   * separados de "buscar" + "crear" que podrían competir entre sí.
   */
  obtenerOCrear(
    params: ObtenerOCrearAtencionParams,
  ): Promise<AtencionPsicologicaDetalle>;
  /** También crea la atención si todavía no existía (mismo criterio que `obtenerOCrear`). */
  actualizarEstado(
    params: ActualizarEstadoAtencionParams,
  ): Promise<AtencionPsicologicaDetalle>;
}
