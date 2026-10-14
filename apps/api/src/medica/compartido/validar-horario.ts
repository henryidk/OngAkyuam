import { BadRequestException } from '@nestjs/common';
import { parseLocalGT } from '@akyuam/shared';
import { dentroDeHorario } from '../dominio/horario';
import { MENSAJE_FUERA_DE_HORARIO, MENSAJE_HORARIO_PASADO } from './mensajes';

/**
 * Convierte el "YYYY-MM-DDTHH:mm" del formulario (hora de Guatemala) al instante de la cita y
 * exige que caiga en el horario de consulta y en el futuro. Si no, 400.
 */
export function exigirInicioValido(inicio: string, ahora: Date): Date {
  const instante = parseLocalGT(inicio);
  if (Number.isNaN(instante.getTime()) || !dentroDeHorario(instante)) {
    throw new BadRequestException(MENSAJE_FUERA_DE_HORARIO);
  }
  if (instante.getTime() <= ahora.getTime()) {
    throw new BadRequestException(MENSAJE_HORARIO_PASADO);
  }
  return instante;
}
