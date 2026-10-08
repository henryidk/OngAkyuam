import type {
  EstadoAtencionPsicologica,
  MotivoCierrePsicologia,
} from '@akyuam/shared';

export const PROCESOS_PSICOLOGIA_REPOSITORY = Symbol(
  'PROCESOS_PSICOLOGIA_REPOSITORY',
);

export interface AccesoProcesoPsicologia {
  id: string;
  expedienteId: string;
  expedienteNumero: string;
  usuariaId: string;
  consecutivo: number;
  etapa: EstadoAtencionPsicologica;
  version: number;
}

export interface AbrirProcesoParams {
  procesoId: string;
  psicologaId: string;
  usuariaId: string;
  fechaHora: Date;
  duracionMinutos: number;
  /** Hijo/a a quien se atiende en la primera cita; null = la usuaria. */
  ninoId: string | null;
}

export interface ProcesoAbierto {
  procesoId: string;
  consecutivo: number;
  citaId: string;
}

export interface CerrarProcesoParams {
  procesoId: string;
  version: number;
  motivo: MotivoCierrePsicologia;
  resumen: string | null;
  cerradoPorId: string;
}

export interface ProcesoCerrado {
  version: number;
  citasCanceladas: number;
}

export interface ActualizarVisibilidadParams {
  procesoId: string;
  version: number;
  visibleJuridico: boolean;
  visibleMedica: boolean;
  actualizadoPorId: string;
}

// Carreras que solo se pueden detectar dentro de la transacción; el servicio las traduce a HTTP.

/** El caso ya no es de esta psicóloga o se cerró entre la validación y el guardado. */
export class ProcesoNoDisponibleError extends Error {}
/** El caso ya tenía primera cita: otro envío abrió el proceso antes. */
export class ProcesoYaAbiertoError extends Error {}
/** La usuaria tiene otro proceso abierto en otro expediente. */
export class OtroProcesoActivoError extends Error {}

export interface IProcesosPsicologiaRepository {
  /**
   * Único punto de verificación "¿este proceso es de esta psicóloga?". `null` tanto si no existe
   * como si es de otra — sin distinción posible desde afuera (sin IDOR).
   */
  buscarAccesoProceso(
    procesoId: string,
    psicologaId: string,
  ): Promise<AccesoProcesoPsicologia | null>;
  ninoPerteneceAExpediente(
    ninoId: string,
    expedienteId: string,
  ): Promise<boolean>;
  /**
   * Abre el proceso de un caso tomado: fija la fecha de inicio y crea la cita de primera
   * atención, todo o nada. Revalida dentro de la transacción que el caso siga siendo de la
   * psicóloga, que no tenga citas y que la usuaria no tenga otro proceso abierto.
   */
  abrir(params: AbrirProcesoParams): Promise<ProcesoAbierto>;
  /**
   * Cierra el proceso y cancela sus citas programadas a futuro, todo o nada. `null` si la
   * versión ya no es la actual o el proceso ya estaba cerrado: no se escribió nada.
   */
  cerrar(params: CerrarProcesoParams): Promise<ProcesoCerrado | null>;
  /** Devuelve la versión nueva, o `null` si la enviada ya no era la actual. */
  actualizarVisibilidad(
    params: ActualizarVisibilidadParams,
  ): Promise<number | null>;
}
