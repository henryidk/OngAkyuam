export interface ProgramarCitaParams {
  expedienteId: string;
  /** Referencia que se atiende; null = el expediente directo (atención activa o referencia pendiente). */
  referidoId: string | null;
  /** Personas de la visita (null = la usuaria), sin repetir. */
  personas: (string | null)[];
  inicio: Date;
  duracionMin: number;
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
   * la referencia pendiente; esa cita (la primera consulta) debe incluir a la usuaria y a todos
   * sus hijos/as registrados. Lanza `HorarioOcupadoError`, `SinReferenciaPendienteError`,
   * `ReferenciaYaAtendidaError`, `PersonaAjenaError` o `PersonasPrimeraConsultaError`.
   */
  programar(params: ProgramarCitaParams): Promise<CitaProgramada>;
  /**
   * Marca la inasistencia y, si se pide, crea la cita nueva (mismas personas y duración) en la
   * misma transacción. Devuelve el
   * id de la nueva cita o null. Lanza `VersionCambioError`, `AtencionNoActivaError` o
   * `HorarioOcupadoError`.
   */
  registrarInasistencia(
    params: RegistrarInasistenciaParams,
  ): Promise<string | null>;
  /**
   * Cita nueva (mismas personas y duración) para una inasistencia que aún no la tiene. Lanza `VersionCambioError`,
   * `CitaNoDisponibleError`, `AtencionNoActivaError` o `HorarioOcupadoError`.
   */
  reprogramar(params: ReprogramarCitaParams): Promise<string>;
  /** Citas que ocupan horario (programadas o atendidas) que empiezan en el rango. */
  listarOcupadas(
    desde: Date,
    hasta: Date,
  ): Promise<{ inicio: Date; duracionMin: number }[]>;
}

export const CITAS_MEDICAS_REPOSITORY = Symbol('CITAS_MEDICAS_REPOSITORY');
