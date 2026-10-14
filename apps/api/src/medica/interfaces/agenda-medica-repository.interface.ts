import type {
  CitaAgendaMedicaDto,
  EstadoCitaMedica,
  PacienteProgramableDto,
  ReferenciaBandejaMedicaDto,
  SinProximaConsultaDto,
} from '@akyuam/shared';

export interface CitaResumida {
  inicio: Date;
  estado: EstadoCitaMedica;
  duracionMin: number;
}

/** A quién se puede programar: una referencia, una usuaria o (sin filtro) todas. */
export interface FiltroProgramables {
  referidoId?: string;
  usuariaId?: string;
}

export interface IAgendaMedicaRepository {
  /** Citas no canceladas que empiezan en [desde, hasta), por hora. `ahora` deriva el estado. */
  citasEntre(
    desde: Date,
    hasta: Date,
    ahora: Date,
  ): Promise<CitaAgendaMedicaDto[]>;
  /** Citas programadas que ya terminaron, fuera de [excluirDesde, excluirHasta). */
  citasSinRegistrar(
    ahora: Date,
    excluirDesde: Date,
    excluirHasta: Date,
  ): Promise<CitaAgendaMedicaDto[]>;
  /** Solo lo necesario para contar: la tira de la semana y el contador del menú. */
  resumenEntre(desde: Date, hasta: Date): Promise<CitaResumida[]>;
  /** Referencias de Trabajo Social pendientes de primera consulta, las más antiguas primero. */
  referenciasPendientes(): Promise<ReferenciaBandejaMedicaDto[]>;
  /** Atenciones activas sin ninguna cita programada (ni futura ni sin registrar). */
  sinProxima(): Promise<SinProximaConsultaDto[]>;
  programables(filtro: FiltroProgramables): Promise<PacienteProgramableDto[]>;
}

export const AGENDA_MEDICA_REPOSITORY = Symbol('AGENDA_MEDICA_REPOSITORY');
