import { HORARIO_PSICOLOGIA, momentoSemanalGT } from '@akyuam/shared';

export const MENSAJE_DIA_NO_LABORABLE =
  'Las citas solo se programan de lunes a viernes';
export const MENSAJE_FUERA_DE_HORARIO =
  'La cita queda fuera del horario de atención';
export const MENSAJE_EN_ALMUERZO =
  'La cita se cruza con el horario de almuerzo';

/**
 * Por qué una cita no cabe en el horario de atención, o `null` si cabe. La pantalla ya ofrece
 * solo horarios válidos; esto es la misma regla del lado del servidor, que no confía en ella.
 */
export function motivoFueraDeHorario(
  fechaHora: Date,
  duracionMinutos: number,
  horario: typeof HORARIO_PSICOLOGIA = HORARIO_PSICOLOGIA,
): string | null {
  const { diaSemana, minutosDelDia: inicio } = momentoSemanalGT(fechaHora);
  const fin = inicio + duracionMinutos;

  if (!(horario.diasLaborables as readonly number[]).includes(diaSemana)) {
    return MENSAJE_DIA_NO_LABORABLE;
  }
  if (inicio < horario.inicioMin || fin > horario.finMin) {
    return MENSAJE_FUERA_DE_HORARIO;
  }
  if (inicio < horario.almuerzoFinMin && fin > horario.almuerzoInicioMin) {
    return MENSAJE_EN_ALMUERZO;
  }
  return null;
}
