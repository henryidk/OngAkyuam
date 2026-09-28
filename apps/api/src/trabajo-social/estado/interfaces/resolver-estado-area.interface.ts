import type { Prisma } from '@prisma/client';
import type { AreaAtencion, EstadoArea } from '@akyuam/shared';

/** Lo que una estrategia necesita saber del referido del área sobre un caso. */
export interface ReferidoParaEstado {
  expedienteId: string;
  /** Profesional asignado por Trabajo Social al referir, si hubo. */
  profesional: string | null;
}

export interface ResultadoEstadoArea {
  estado: EstadoArea;
  detalle: string;
  /** El área puede conocer mejor quién atiende (p. ej. la psicóloga que reclamó el caso). */
  profesional: string | null;
}

/**
 * Cómo va un área con un caso que le fue referido. Un área nueva, o un cambio en cómo cierra
 * un área, es una clase nueva registrada en `ResolveresEstadoArea` — el orquestador no cambia.
 * Nunca se llama para un área no referida: sin referido no hay estado del área.
 */
export interface IResolverEstadoArea {
  readonly area: AreaAtencion;
  resolver(referido: ReferidoParaEstado): Promise<ResultadoEstadoArea>;
  /**
   * La misma regla de "ACTIVA" que `resolver`, como condición SQL sobre la columna de
   * `expedienteId` — la lista de Usuarias calcula el estado de cada fila en una sola consulta
   * (sin N+1). Vive junto a `resolver` para que un cambio de regla toque ambos a la vez.
   */
  condicionActivaSql(columnaExpedienteId: Prisma.Sql): Prisma.Sql;
}
