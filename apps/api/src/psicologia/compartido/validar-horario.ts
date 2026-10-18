import { BadRequestException } from '@nestjs/common';
import {
  horarioPsicologiaValido,
  MENSAJE_HORARIO_PSICOLOGIA,
} from '@akyuam/shared';
export function validarHorarioPsicologia(
  fechaHora: string,
  duracionMinutos: number,
): void {
  if (!horarioPsicologiaValido({ fechaHora, duracionMinutos }))
    throw new BadRequestException(MENSAJE_HORARIO_PSICOLOGIA);
}
