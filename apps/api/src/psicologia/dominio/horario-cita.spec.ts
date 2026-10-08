import { parseLocalGT } from '@akyuam/shared';
import {
  MENSAJE_DIA_NO_LABORABLE,
  MENSAJE_EN_ALMUERZO,
  MENSAJE_FUERA_DE_HORARIO,
  motivoFueraDeHorario,
} from './horario-cita';

// 2026-10-07 es miércoles; 2026-10-10, sábado. Las horas son de Guatemala.
function motivo(fechaHoraLocal: string, duracionMinutos = 45): string | null {
  return motivoFueraDeHorario(parseLocalGT(fechaHoraLocal), duracionMinutos);
}

describe('motivoFueraDeHorario', () => {
  it.each([
    ['2026-10-07T08:00', 45],
    ['2026-10-07T11:15', 45],
    ['2026-10-07T13:00', 90],
    ['2026-10-07T16:15', 45],
  ])('acepta %s (%i min)', (fechaHora, duracion) => {
    expect(motivo(fechaHora, duracion)).toBeNull();
  });

  it('rechaza sábado y domingo', () => {
    expect(motivo('2026-10-10T09:00')).toBe(MENSAJE_DIA_NO_LABORABLE);
    expect(motivo('2026-10-11T09:00')).toBe(MENSAJE_DIA_NO_LABORABLE);
  });

  it('rechaza antes de abrir y lo que termina después de cerrar', () => {
    expect(motivo('2026-10-07T07:45')).toBe(MENSAJE_FUERA_DE_HORARIO);
    expect(motivo('2026-10-07T16:30')).toBe(MENSAJE_FUERA_DE_HORARIO);
  });

  it('rechaza lo que toca el almuerzo, aunque empiece antes o termine después', () => {
    expect(motivo('2026-10-07T11:30')).toBe(MENSAJE_EN_ALMUERZO);
    expect(motivo('2026-10-07T12:15')).toBe(MENSAJE_EN_ALMUERZO);
    expect(motivo('2026-10-07T12:45')).toBe(MENSAJE_EN_ALMUERZO);
  });

  it('usa el día de Guatemala: las 18:00 del viernes ya son sábado en UTC', () => {
    // Viernes 18:00 GT = sábado 00:00 UTC: se rechaza por la hora, no por "fin de semana".
    expect(motivo('2026-10-09T18:00')).toBe(MENSAJE_FUERA_DE_HORARIO);
  });
});
