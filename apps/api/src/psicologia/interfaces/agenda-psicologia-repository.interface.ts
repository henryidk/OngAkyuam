import type { CitaAgendaDto } from '@akyuam/shared';

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
}
