export const ATENCION_PSICOLOGICA_REPOSITORY = Symbol(
  'ATENCION_PSICOLOGICA_REPOSITORY',
);

export interface PaginaConCursorRepo<T> {
  items: T[];
  siguienteCursor: string | null;
}

export interface IAtencionPsicologicaRepository {
  /*
   * Indicadores: `psicologaId` = la dueña de los procesos, o `null` para toda el área (cualquier
   * psicóloga puede ver las cifras del equipo).
   */
  /** Cuándo se tomó el primer proceso del alcance; `null` si aún no hay ninguno. */
  fechaPrimerProceso(psicologaId: string | null): Promise<Date | null>;
  /** Casos activos (estado != CIERRE) — "casos activos" de indicadores. */
  contarCasosActivos(psicologaId: string | null): Promise<number>;
  /** Casos cuya atención se creó dentro del rango — "procesos iniciados" de indicadores. */
  contarIniciadosEnRango(
    psicologaId: string | null,
    desde: Date,
    hasta: Date,
  ): Promise<number>;
  /** Casos cerrados dentro del rango — "procesos cerrados" de indicadores. */
  contarCerradosEnRango(
    psicologaId: string | null,
    desde: Date,
    hasta: Date,
  ): Promise<number>;
}
