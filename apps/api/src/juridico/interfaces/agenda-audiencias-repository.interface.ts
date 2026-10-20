import type {
  AudienciaDetalleDto,
  AudienciaFilaDto,
  AudienciaOcupadaDto,
  EstadoAudiencia,
  VistaAudiencias,
} from '@akyuam/shared';

export const AGENDA_AUDIENCIAS_REPOSITORY = Symbol(
  'AGENDA_AUDIENCIAS_REPOSITORY',
);

export interface ListarAudienciasParams {
  vista: VistaAudiencias;
  q?: string;
  responsableId?: string;
  /** Solo las de la ficha de `Personal` enlazada a esta cuenta. */
  responsableUsuarioId?: string;
  /** Límites del rango ya convertidos a instantes con `inicioDiaGT` / `finDiaGT`. */
  desde?: Date;
  hasta?: Date;
  estado?: EstadoAudiencia;
  page: number;
  pageSize: number;
  /** El reloj de la petición: separa Próximas de Pendientes y deriva el estado visible. */
  ahora: Date;
}

/**
 * Lecturas de audiencias. Todas pasan por el proceso con acceso (nunca por el id de la
 * audiencia sola), así que nada de un expediente no referido a Jurídico sale de aquí.
 */
export interface IAgendaAudienciasRepository {
  listar(
    params: ListarAudienciasParams,
  ): Promise<{ items: AudienciaFilaDto[]; total: number }>;
  /** Las PROGRAMADAS de esa responsable entre `desde` y `hasta`, por hora. */
  listarOcupadas(
    responsableId: string,
    desde: Date,
    hasta: Date,
  ): Promise<AudienciaOcupadaDto[]>;
  /** Historial completo del proceso, de la más reciente a la más antigua. */
  listarPorProceso(
    procesoId: string,
    ahora: Date,
  ): Promise<AudienciaDetalleDto[]>;
}
