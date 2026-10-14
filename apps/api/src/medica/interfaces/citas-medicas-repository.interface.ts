export interface ProgramarCitaParams {
  expedienteId: string;
  /** Referencia que se atiende; null = el expediente directo (atención activa o referencia pendiente). */
  referidoId: string | null;
  ninoId: string | null;
  inicio: Date;
  creadoPorId: string;
  /** Fecha de calendario de hoy en Guatemala: inicio de la atención si se abre. */
  hoy: string;
}

export interface CitaProgramada {
  citaId: string;
  atencionId: string;
  consecutivo: number;
  atencionAbierta: boolean;
}

export interface RegistrarInasistenciaParams {
  citaId: string;
  version: number;
  /** Momento actual: la cita debe haber empezado. */
  ahora: Date;
  reprogramarA: Date | null;
  creadoPorId: string;
}

export interface ReprogramarCitaParams {
  citaId: string;
  version: number;
  inicio: Date;
  creadoPorId: string;
}

export interface ICitasMedicasRepository {
  /**
   * Programa una cita. Si el expediente no tiene atención activa, abre una (M{n+1}) a partir de
   * la referencia pendiente. Lanza `HorarioOcupadoError`, `SinReferenciaPendienteError` o
   * `ReferenciaYaAtendidaError`.
   */
  programar(params: ProgramarCitaParams): Promise<CitaProgramada>;
  /**
   * Marca la inasistencia y, si se pide, crea la cita nueva en la misma transacción. Devuelve el
   * id de la nueva cita o null. Lanza `VersionCambioError`, `AtencionNoActivaError` o
   * `HorarioOcupadoError`.
   */
  registrarInasistencia(
    params: RegistrarInasistenciaParams,
  ): Promise<string | null>;
  /**
   * Cita nueva para una inasistencia que aún no la tiene. Lanza `VersionCambioError`,
   * `CitaNoDisponibleError`, `AtencionNoActivaError` o `HorarioOcupadoError`.
   */
  reprogramar(params: ReprogramarCitaParams): Promise<string>;
  /** Inicios de las citas que ocupan horario (programadas o atendidas) en el rango. */
  listarOcupadas(desde: Date, hasta: Date): Promise<Date[]>;
}

export const CITAS_MEDICAS_REPOSITORY = Symbol('CITAS_MEDICAS_REPOSITORY');
