import type { CitaAgendaDto, ProcesoParaAgendarDto } from '@akyuam/shared';

export const AGENDA_PSICOLOGIA_REPOSITORY = Symbol(
  'AGENDA_PSICOLOGIA_REPOSITORY',
);

export interface RangoAgendaParams {
  psicologaId: string;
  desde: Date;
  hasta: Date;
}

export interface CitaOcupada {
  fechaHora: Date;
  duracionMinutos: number;
}

export interface ProgramarCitaParams {
  procesoId: string;
  psicologaId: string;
  fechaHora: Date;
  duracionMinutos: number;
  ninoId: string | null;
}

export interface MoverCitaParams {
  citaId: string;
  psicologaId: string;
  fechaHora: Date;
  duracionMinutos: number;
}

/** La agenda siempre es la de quien consulta: todas las lecturas filtran por la psicóloga dueña. */
export interface IAgendaPsicologiaRepository {
  /** Citas que ocupan agenda en el rango (ni canceladas ni reprogramadas), en orden cronológico. */
  listarCitas(
    params: RangoAgendaParams & { ahora: Date },
  ): Promise<CitaAgendaDto[]>;
  /** Solo horario y duración de las mismas citas, para calcular los huecos libres. */
  listarOcupadas(params: RangoAgendaParams): Promise<CitaOcupada[]>;
  /**
   * Marca "no asistió" una cita que sigue programada y cuya hora ya llegó, en un proceso sin
   * cerrar. `false` si no cumplía eso (ya se registró, aún no ocurre): no se escribió nada.
   * Se usa tras `exigirAccesoCita`.
   */
  marcarNoAsistio(citaId: string, ahora: Date): Promise<boolean>;
  /**
   * Mis procesos sin cerrar que ya abrieron (tienen primera cita agendada), con las personas a
   * quienes se puede citar y su próxima cita programada, si la tienen.
   */
  listarProcesosParaAgendar(
    psicologaId: string,
    ahora: Date,
  ): Promise<ProcesoParaAgendarDto[]>;
  /**
   * Crea una cita de seguimiento en un proceso de esta psicóloga que siga sin cerrar. Devuelve
   * el id de la cita, o `null` si el proceso se cerró o cambió de dueña mientras tanto: no se
   * escribió nada. Se usa tras `exigirAccesoProceso`.
   */
  programarCita(params: ProgramarCitaParams): Promise<string | null>;
  /**
   * Mueve una cita que sigue programada: la anterior queda `REPROGRAMADA` y nace otra en la
   * fecha nueva para la misma persona, todo o nada. `null` si ya no estaba programada o el
   * proceso se cerró. Se usa tras `exigirAccesoCita`.
   */
  moverCita(params: MoverCitaParams): Promise<string | null>;
}
