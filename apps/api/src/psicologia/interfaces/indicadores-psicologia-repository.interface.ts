import type { ReportePsicologia } from '@akyuam/shared';
import type { RangoFechas } from './citas-psicologicas-repository.interface';

export const INDICADORES_PSICOLOGIA_REPOSITORY = Symbol(
  'INDICADORES_PSICOLOGIA_REPOSITORY',
);

/** Reporte agregado sin `desde`/`hasta`: esos dos campos los agrega el servicio directamente
 *  desde el string de calendario ya validado en el query, nunca recalculados a partir de un
 *  `Date` en UTC (evitaría el bug de rollover de medianoche que la disciplina de fechas del
 *  proyecto existe para evitar). */
export type ReporteAgregado = Omit<ReportePsicologia, 'desde' | 'hasta'>;

/**
 * Reporte legado pre-rediseño (§7.2 del plan): agrega sobre **todas** las psicólogas, sin
 * filtro por dueña — se mantiene intacto para el frontend viejo (`ReportePsicologia.tsx`).
 * Los indicadores nuevos de Fase 6 (`GET /psicologia/indicadores`, siempre "mis" casos) no
 * viven aquí: `IndicadoresPsicologiaService.obtenerIndicadores` los compone reusando
 * `IAtencionPsicologicaRepository` (conteos de procesos) e `ICitasPsicologicasRepository`
 * (`listarCitasEnRango`, ya usado por `/agenda/resumen`) — evita duplicar la misma consulta de
 * citas por psicóloga en dos repositorios distintos.
 */
export interface IIndicadoresPsicologiaRepository {
  obtenerReporte(rango: RangoFechas): Promise<ReporteAgregado>;
}
