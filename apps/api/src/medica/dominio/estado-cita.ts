import type {
  EstadoCitaMedica,
  EstadoCitaMedicaDerivado,
} from '@akyuam/shared';
import { finCita } from './horario';

export interface CitaParaEstado {
  estado: EstadoCitaMedica;
  inicio: Date;
  duracionMin: number;
}

/**
 * Estado que se muestra. Una cita PROGRAMADA está EN_CURSO dentro de su intervalo
 * [inicio, fin) y SIN_REGISTRAR desde que termina; los demás estados se muestran tal cual.
 * La misma función alimenta la lista del día, los paneles y los contadores.
 */
export function derivarEstadoCita(
  cita: CitaParaEstado,
  ahora: Date,
): EstadoCitaMedicaDerivado {
  if (cita.estado !== 'PROGRAMADA') {
    return cita.estado;
  }
  const t = ahora.getTime();
  if (t >= finCita(cita.inicio, cita.duracionMin).getTime()) {
    return 'SIN_REGISTRAR';
  }
  if (t >= cita.inicio.getTime()) {
    return 'EN_CURSO';
  }
  return 'PROGRAMADA';
}

/** La inasistencia solo se registra cuando la cita ya empezó y sigue sin registrar. */
export function admiteInasistencia(cita: CitaParaEstado, ahora: Date): boolean {
  const estado = derivarEstadoCita(cita, ahora);
  return estado === 'EN_CURSO' || estado === 'SIN_REGISTRAR';
}
