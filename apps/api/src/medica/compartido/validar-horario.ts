import { BadRequestException } from '@nestjs/common';
import {
  fechaCalendarioGT,
  limiteAgendaMedica,
  parseLocalGT,
} from '@akyuam/shared';
import { dentroDeHorario } from '../dominio/horario';
import {
  MENSAJE_FUERA_DE_HORARIO,
  MENSAJE_HORARIO_MUY_LEJANO,
  MENSAJE_HORARIO_PASADO,
} from './mensajes';

/**
 * Convierte el "YYYY-MM-DDTHH:mm" del formulario (hora de Guatemala) al instante de la cita y
 * exige que la cita completa (con su duración) caiga en el horario de consulta, en el futuro y
 * a no más de un mes (`limiteAgendaMedica`). Si no, 400.
 */
export function exigirInicioValido(
  inicio: string,
  ahora: Date,
  duracionMin?: number,
): Date {
  const instante = parseLocalGT(inicio);
  if (
    Number.isNaN(instante.getTime()) ||
    !dentroDeHorario(instante, duracionMin)
  ) {
    throw new BadRequestException(MENSAJE_FUERA_DE_HORARIO);
  }
  if (instante.getTime() <= ahora.getTime()) {
    throw new BadRequestException(MENSAJE_HORARIO_PASADO);
  }
  if (
    fechaCalendarioGT(instante) > limiteAgendaMedica(fechaCalendarioGT(ahora))
  ) {
    throw new BadRequestException(MENSAJE_HORARIO_MUY_LEJANO);
  }
  return instante;
}
