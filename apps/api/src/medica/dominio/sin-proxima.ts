import {
  corteSinVenirMedica,
  fechaCalendarioGT,
  inicioDiaGT,
  sumarDiasGT,
} from '@akyuam/shared';
import type { FiltroSinProxima } from '../interfaces/agenda-medica-repository.interface';

/**
 * El corte de "sin venir" visto desde `ahora`, listo para comparar en SQL: el día (para la fecha de
 * inicio, que no tiene hora) y el instante en que empieza el día siguiente en Guatemala (para la
 * última consulta o falta). Un instante anterior a ese límite cae en un día igual o anterior al
 * corte: el mismo resultado que `dejoDeVenirMedica` sobre la fecha de calendario.
 */
export function corteSinVenir(ahora: Date): FiltroSinProxima['corte'] {
  const fecha = corteSinVenirMedica(fechaCalendarioGT(ahora));
  return { fecha, instante: inicioDiaGT(sumarDiasGT(fecha, 1)) };
}
