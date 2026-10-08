import type {
  AtencionPsicologicaDetalle,
  CasoCerradoResumen,
  EstadoAtencionPsicologica,
  ExpedienteResumenBusqueda,
  ExpedienteResumenPsicologia,
  ProcesoSinProximaCita,
  ReferenciaSinTomar,
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
  motivo: string | null;
  actualizadoPorId: string;
}

export interface TomarCasoParams {
  expedienteId: string;
  psicologaId: string;
}

/**
 * `YA_TOMADO` cubre tanto la carrera concurrente (alguien más ganó el `update` condicional)
 * como el reintento de la misma psicóloga sobre un caso que ya es suyo — en ambos casos el
 * endpoint no debe crear un segundo hito de "tomado", así que el servicio decide qué hacer con
 * cada uno mirando quién quedó como dueño, no repitiendo la lógica de asignación aquí.
 */
export type ResultadoTomarCaso = 'TOMADO' | 'YA_TOMADO';

export interface BuscarExpedientesParams {
  psicologaId: string;
  q?: string;
  estado?: EstadoAtencionPsicologica;
  municipio?: string;
  cursor?: string;
  limite: number;
}

export interface PaginaConCursorRepo<T> {
  items: T[];
  siguienteCursor: string | null;
}

export interface IAtencionPsicologicaRepository {
  /**
   * `null` si el expediente no existe, no fue referido a PSICOLOGIA, o fue referido pero está
   * asignado a otra psicóloga (`psicologaId` no coincide) — nunca se distingue el motivo en el
   * resultado: los tres casos son indistinguibles desde afuera (§7.4 del plan, anti-enumeración).
   * Un expediente referido pero aún sin tomar (`psicologaAsignadaId` null) tampoco da acceso —
   * solo aparece en `listarReferenciasSinTomar`, de solo lectura, hasta que alguien lo reclame.
   */
  buscarExpedienteConAcceso(
    expedienteId: string,
    psicologaId: string,
  ): Promise<ExpedienteAccesoPsicologia | null>;
  /**
   * Obtiene la atención del expediente o la crea perezosamente (estado INICIO) la primera
   * vez que psicología abre ese expediente — `upsert` en la implementación, nunca dos pasos
   * separados de "buscar" + "crear" que podrían competir entre sí.
   */
  obtenerOCrear(
    params: ObtenerOCrearAtencionParams,
  ): Promise<AtencionPsicologicaDetalle>;
  /**
   * También crea la atención si todavía no existía (mismo criterio que `obtenerOCrear`).
   * Registra un hito (`CambioEstadoAtencion`) por cada transición real de estado.
   */
  actualizarEstado(
    params: ActualizarEstadoAtencionParams,
  ): Promise<AtencionPsicologicaDetalle>;
  /**
   * Verifica solo que el expediente esté referido a PSICOLOGIA, sin importar si ya fue tomado
   * — usado exclusivamente por `tomarCaso`, que es precisamente la acción que establece esa
   * reclamación (por eso no puede exigir ya tener `psicologaAsignadaId`).
   */
  existeReferidoPsicologia(expedienteId: string): Promise<boolean>;
  /**
   * Reclamo atómico: asigna `psicologaId` solo si el expediente aún no tiene dueña. Nunca
   * revela a quién pertenece un caso ya tomado — el llamador solo distingue `TOMADO`/`YA_TOMADO`.
   */
  tomarCaso(params: TomarCasoParams): Promise<ResultadoTomarCaso>;
  /** Cola de trabajo del área: referidos a PSICOLOGIA que nadie ha tomado todavía. */
  listarReferenciasSinTomar(): Promise<ReferenciaSinTomar[]>;
  /** Casos activos (estado != CIERRE) tomados por esta psicóloga — bloque de métricas del tablero e indicadores. */
  contarCasosActivos(psicologaId: string): Promise<number>;
  /** Casos tomados por esta psicóloga cuya atención se creó dentro del rango — "procesos iniciados" de indicadores. */
  contarIniciadosEnRango(
    psicologaId: string,
    desde: Date,
    hasta: Date,
  ): Promise<number>;
  /** Casos tomados por esta psicóloga cerrados dentro del rango — "procesos cerrados" de indicadores. */
  contarCerradosEnRango(
    psicologaId: string,
    desde: Date,
    hasta: Date,
  ): Promise<number>;
  /** Casos activos de esta psicóloga sin ninguna cita PROGRAMADA futura — bloque del tablero (§5.1 del plan). */
  listarProcesosSinProximaCita(
    psicologaId: string,
  ): Promise<ProcesoSinProximaCita[]>;
  /** Casos de esta psicóloga cerrados desde `desde` (inclusive) — bloque "cerrados esta semana" del tablero. */
  listarCerradosDesde(
    psicologaId: string,
    desde: Date,
  ): Promise<CasoCerradoResumen[]>;
  /**
   * Búsqueda paginada por cursor entre los casos tomados por esta psicóloga (§7.3/§7.5 del
   * plan: nunca `findMany` sin `take`) — nunca casos de otra psicóloga, sin excepción.
   */
  buscarExpedientes(
    params: BuscarExpedientesParams,
  ): Promise<PaginaConCursorRepo<ExpedienteResumenBusqueda>>;
  /**
   * Cabecera de un caso puntual para la tab "Resumen del proceso" (§5.3 del plan) — nunca el
   * listado completo de citas, eso es `ICitasPsicologicasRepository.listarHistorial`. `null`
   * solo puede darse si el expediente desaparece entre el guard de acceso y esta lectura.
   */
  obtenerResumenExpediente(
    expedienteId: string,
    psicologaId: string,
  ): Promise<ExpedienteResumenPsicologia | null>;
}
