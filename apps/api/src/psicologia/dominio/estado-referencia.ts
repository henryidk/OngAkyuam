import type {
  EstadoAtencionPsicologica,
  EstadoReferenciaPsicologia,
} from '@akyuam/shared';

/** Lo que hace falta saber de un caso ya tomado para decidir en qué quedó su referencia. */
export interface AtencionTomada {
  referidoId: string | null;
  psicologaAsignadaId: string | null;
  fechaInicio: Date | null;
  estado: EstadoAtencionPsicologica;
}

/**
 * En qué quedó una referencia, vista por una psicóloga. "Por agendar" es una tarea pendiente de
 * quien tomó el caso: a las demás, el caso que tomó una colega no les pide agendar nada.
 *
 * @param tomadas los casos del expediente que ya tienen psicóloga asignada.
 */
export function estadoReferencia(
  referidoId: string,
  tomadas: AtencionTomada[],
  psicologaId: string,
): EstadoReferenciaPsicologia {
  if (tomadas.length === 0) {
    return 'SIN_TOMAR';
  }
  const porAgendar = tomadas.some(
    (atencion) =>
      atencion.psicologaAsignadaId === psicologaId &&
      atencion.referidoId === referidoId &&
      atencion.fechaInicio === null &&
      atencion.estado !== 'CIERRE',
  );
  return porAgendar ? 'POR_AGENDAR' : 'ATENDIDA';
}
