export const ATENCION_PSICOLOGICA_REPOSITORY = Symbol(
  'ATENCION_PSICOLOGICA_REPOSITORY',
);

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

export interface PaginaConCursorRepo<T> {
  items: T[];
  siguienteCursor: string | null;
}

export interface IAtencionPsicologicaRepository {
  /**
   * Reclamo atómico: asigna `psicologaId` solo si el expediente aún no tiene dueña. Nunca
   * revela a quién pertenece un caso ya tomado — el llamador solo distingue `TOMADO`/`YA_TOMADO`.
   */
  tomarCaso(params: TomarCasoParams): Promise<ResultadoTomarCaso>;
  /** Casos activos (estado != CIERRE) tomados por esta psicóloga — "casos activos" de indicadores. */
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
}
