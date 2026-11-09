import type {
  CitaAgendaMedicaDto,
  GrupoSinProximaMedica,
  SinProximaMedicaPaginaDto,
  EstadoCitaMedica,
  PacienteProgramableDto,
  ReferenciaBandejaMedicaDto,
  SinProximaConsultaDto,
} from '@akyuam/shared';

import type { BusquedaListaUsuarias } from '../../common/busqueda-usuarias';

export interface CitaResumida {
  inicio: Date;
  estado: EstadoCitaMedica;
  duracionMin: number;
}

/** Filtro de "Sin próxima consulta". `corte` sale de `corteSinVenirMedica(hoy)`. */
export interface FiltroSinProxima {
  busqueda?: BusquedaListaUsuarias;
  grupo?: GrupoSinProximaMedica;
  corte: {
    /** Último día "sin venir" ("YYYY-MM-DD", Guatemala). */
    fecha: string;
    /** Inicio, en Guatemala, del día siguiente al corte: lo anterior cuenta como "sin venir". */
    instante: Date;
  };
}

export type ConteosSinProxima = SinProximaMedicaPaginaDto['conteos'];

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
  /** Citas programadas que ya terminaron, fuera de [excluirDesde, excluirHasta), la más reciente primero. */
  citasSinRegistrar(
    ahora: Date,
    excluirDesde: Date,
    excluirHasta: Date,
    limite: number,
  ): Promise<CitaAgendaMedicaDto[]>;
  /** Cuántas hay en total con la misma condición, sin traerlas. */
  contarCitasSinRegistrar(
    ahora: Date,
    excluirDesde: Date,
    excluirHasta: Date,
  ): Promise<number>;
  /** Solo lo necesario para contar: la tira de la semana y el contador del menú. */
  resumenEntre(desde: Date, hasta: Date): Promise<CitaResumida[]>;
}

/** Quién espera algo de la médica sin tener una cita delante. */
export interface ILectorPendientesMedica {
  /** Referencias de Trabajo Social pendientes de primera consulta, las más antiguas primero. */
  referenciasPendientes(limite: number): Promise<ReferenciaBandejaMedicaDto[]>;
  /** Cuántas referencias esperan primera consulta: el número del menú, sin traer las filas. */
  contarReferenciasPendientes(): Promise<number>;
  /**
   * Una página de atenciones activas sin ninguna cita programada (ni futura ni sin registrar), de
   * la más reciente a la más antigua.
   */
  paginaSinProxima(
    filtro: FiltroSinProxima,
    pagina: number,
    porPagina: number,
  ): Promise<SinProximaConsultaDto[]>;
  /** Totales por grupo con la misma definición que `paginaSinProxima`. */
  conteosSinProxima(
    filtro: Omit<FiltroSinProxima, 'grupo'>,
  ): Promise<ConteosSinProxima>;
  programables(filtro: FiltroProgramables): Promise<PacienteProgramableDto[]>;
}

export const LECTOR_CITAS_MEDICAS = Symbol('LECTOR_CITAS_MEDICAS');
export const LECTOR_PENDIENTES_MEDICA = Symbol('LECTOR_PENDIENTES_MEDICA');
