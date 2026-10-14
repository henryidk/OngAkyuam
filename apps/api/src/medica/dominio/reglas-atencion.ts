import type {
  EstadoAtencionMedica,
  FiltroPacientesMedica,
} from '@akyuam/shared';

export interface AtencionParaReglas {
  estado: EstadoAtencionMedica;
  createdAt: Date;
}

/**
 * Una referencia de Trabajo Social a Medicina está pendiente de primera consulta mientras el
 * expediente no tenga una atención activa ni una abierta después de la referencia. Es la misma
 * regla que el SQL `REFERENCIA_PENDIENTE_SQL`.
 */
export function referenciaPendiente(
  referidoEn: Date,
  atencionesDelExpediente: readonly AtencionParaReglas[],
): boolean {
  return !atencionesDelExpediente.some(
    (atencion) =>
      atencion.estado === 'ACTIVA' ||
      atencion.createdAt.getTime() >= referidoEn.getTime(),
  );
}

/**
 * Situación de una usuaria en Medicina, sumando todos sus expedientes: en atención si alguno
 * tiene atención activa; si no, por agendar si tiene una referencia pendiente; si no, de alta.
 */
export function situacionPaciente(
  tieneAtencionActiva: boolean,
  tieneReferenciaPendiente: boolean,
): FiltroPacientesMedica {
  if (tieneAtencionActiva) {
    return 'EN_ATENCION';
  }
  return tieneReferenciaPendiente ? 'POR_AGENDAR' : 'DE_ALTA';
}

/**
 * "Reprogramar" en una inasistencia: solo si nadie la reprogramó ya, la atención sigue activa y
 * la paciente no tiene otra cita futura (si la tiene, ya está agendada).
 */
export function puedeReprogramar(cita: {
  estado: string;
  reprogramadaA: unknown;
  atencionActiva: boolean;
  tieneCitaFutura: boolean;
}): boolean {
  return (
    cita.estado === 'NO_ASISTIO' &&
    cita.reprogramadaA === null &&
    cita.atencionActiva &&
    !cita.tieneCitaFutura
  );
}
