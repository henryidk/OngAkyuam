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

/**
 * Lecturas de citas para la Agenda, Consultas y los contadores. Separada de
 * `ILectorPendientesMedica` para que cada servicio dependa solo de lo que usa; las dos las
 * implementa `AgendaMedicaRepository`.
 */
export interface ILectorCitasMedicas {
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
}

/** Quién espera algo de la médica sin tener una cita delante. */
export interface ILectorPendientesMedica {
  /** Referencias de Trabajo Social pendientes de primera consulta, las más antiguas primero. */
  referenciasPendientes(): Promise<ReferenciaBandejaMedicaDto[]>;
  /** Atenciones activas sin ninguna cita programada (ni futura ni sin registrar). */
  sinProxima(): Promise<SinProximaConsultaDto[]>;
  programables(filtro: FiltroProgramables): Promise<PacienteProgramableDto[]>;
}

export const LECTOR_CITAS_MEDICAS = Symbol('LECTOR_CITAS_MEDICAS');
export const LECTOR_PENDIENTES_MEDICA = Symbol('LECTOR_PENDIENTES_MEDICA');
