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
 * Una cita que todavía no empieza y sigue programada, sin consulta registrada, se puede mover a
 * otro horario (la misma cita cambia de hora; no se crea otra).
 */
export function esCitaPorMover(
  cita: { estado: string; inicio: Date; tieneConsultas: boolean },
  ahora: Date,
): boolean {
  return (
    cita.estado === 'PROGRAMADA' &&
    cita.inicio.getTime() > ahora.getTime() &&
    !cita.tieneConsultas
  );
}

/**
 * "Reprogramar" con la atención activa en dos casos: una cita futura que sigue programada (se
 * mueve), o una inasistencia que nadie reprogramó y sin otra cita futura de la paciente (si la
 * tiene, ya está agendada).
 */
export function puedeReprogramar(
  cita: {
    estado: string;
    inicio: Date;
    tieneConsultas: boolean;
    reprogramadaA: unknown;
    atencionActiva: boolean;
    tieneCitaFutura: boolean;
  },
  ahora: Date,
): boolean {
  if (!cita.atencionActiva) {
    return false;
  }
  if (esCitaPorMover(cita, ahora)) {
    return true;
  }
  return (
    cita.estado === 'NO_ASISTIO' &&
    cita.reprogramadaA === null &&
    !cita.tieneCitaFutura
  );
}
