import {
  ANIOS_MAXIMOS_AGENDA_AUDIENCIA,
  fechaCalendarioGT,
} from '@akyuam/shared';

/** Por qué no se puede agendar en ese instante. */
export type ProblemaHorarioAudiencia = 'NO_ES_FUTURO' | 'DEMASIADO_LEJOS';

/**
 * Agendar es solo hacia el futuro y como máximo a 3 años (más allá casi seguro es un error de
 * captura, como 2062 por 2026). El límite se cuenta por día de calendario de Guatemala.
 */
export function problemaHorarioAgenda(
  inicio: Date,
  ahora: Date,
): ProblemaHorarioAudiencia | null {
  if (inicio <= ahora) {
    return 'NO_ES_FUTURO';
  }
  const hoy = fechaCalendarioGT(ahora);
  const anioLimite = Number(hoy.slice(0, 4)) + ANIOS_MAXIMOS_AGENDA_AUDIENCIA;
  // "YYYY-MM-DD" se ordena igual como texto que como fecha; un 29/02 inexistente en el año
  // límite sigue quedando entre el 28/02 y el 01/03, que es lo correcto.
  const limite = `${anioLimite}${hoy.slice(4)}`;
  return fechaCalendarioGT(inicio) > limite ? 'DEMASIADO_LEJOS' : null;
}
