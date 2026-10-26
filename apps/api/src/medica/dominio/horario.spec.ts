import { calcularImc, sugerirHorario } from '@akyuam/shared';
import { exigirInicioValido } from '../compartido/validar-horario';
import {
  dentroDeHorario,
  diasHabilesDesde,
  esDiaHabil,
  horaFin,
  horasLibres,
  inicioCita,
} from './horario';

// 2026-10-12 es lunes. Guatemala es UTC−6 todo el año: 08:00 GT = 14:00 UTC.
const LUNES = '2026-10-12';

describe('horario de Medicina', () => {
  it('lunes a viernes son hábiles; sábado y domingo no', () => {
    expect(esDiaHabil(LUNES)).toBe(true);
    expect(esDiaHabil('2026-10-16')).toBe(true);
    expect(esDiaHabil('2026-10-17')).toBe(false);
    expect(esDiaHabil('2026-10-18')).toBe(false);
  });

  it('el inicio de una cita se interpreta en hora de Guatemala', () => {
    expect(inicioCita(LUNES, '08:00').toISOString()).toBe(
      '2026-10-12T14:00:00.000Z',
    );
  });

  it('horaFin suma la duración de 30 minutos, cruzando la hora', () => {
    expect(horaFin('08:30')).toBe('09:00');
    expect(horaFin('16:30')).toBe('17:00');
  });

  it('solo acepta horas del horario, al minuto exacto y en día hábil', () => {
    expect(dentroDeHorario(inicioCita(LUNES, '08:00'))).toBe(true);
    // Sin hueco de almuerzo: el mediodía se agenda como cualquier hora.
    expect(dentroDeHorario(inicioCita(LUNES, '12:30'))).toBe(true);
    // La última empieza 16:30 y termina 17:00; 17:00 y antes de 08:00 quedan fuera.
    expect(dentroDeHorario(inicioCita(LUNES, '16:30'))).toBe(true);
    expect(dentroDeHorario(inicioCita(LUNES, '17:00'))).toBe(false);
    expect(dentroDeHorario(inicioCita(LUNES, '07:30'))).toBe(false);
    expect(dentroDeHorario(inicioCita(LUNES, '08:15'))).toBe(false);
    expect(dentroDeHorario(inicioCita('2026-10-17', '08:00'))).toBe(false);
    const conSegundos = new Date(inicioCita(LUNES, '08:00').getTime() + 1_000);
    expect(dentroDeHorario(conSegundos)).toBe(false);
  });

  it('diasHabilesDesde salta el fin de semana', () => {
    expect(diasHabilesDesde('2026-10-16', 3)).toEqual([
      '2026-10-16',
      '2026-10-19',
      '2026-10-20',
    ]);
    expect(diasHabilesDesde('2026-10-17', 1)).toEqual(['2026-10-19']);
  });

  it('horasLibres quita las ocupadas y las que ya empezaron', () => {
    const ahora = inicioCita(LUNES, '14:10');
    expect(horasLibres(LUNES, new Set(['15:00']), ahora)).toEqual([
      '14:30',
      '15:30',
      '16:00',
      '16:30',
    ]);
    expect(horasLibres('2026-10-17', new Set(), ahora)).toEqual([]);
  });

  it('exigirInicioValido rechaza horas fuera de horario y del pasado', () => {
    const ahora = inicioCita(LUNES, '10:00');
    expect(exigirInicioValido('2026-10-12T10:30', ahora).toISOString()).toBe(
      '2026-10-12T16:30:00.000Z',
    );
    expect(() => exigirInicioValido('2026-10-12T17:00', ahora)).toThrow();
    expect(() => exigirInicioValido('2026-10-12T09:00', ahora)).toThrow();
    // La misma hora que "ahora" ya empezó.
    expect(() => exigirInicioValido('2026-10-12T10:00', ahora)).toThrow();
    expect(() => exigirInicioValido('no-es-fecha', ahora)).toThrow();
  });
});

describe('sugerirHorario', () => {
  const disponibilidad = [
    { fecha: '2026-10-12', libres: [] },
    { fecha: '2026-10-13', libres: ['09:00', '10:00'] },
    { fecha: '2026-10-14', libres: ['08:00'] },
  ];

  it('sin preferencia, el primer día con espacio y su primera hora', () => {
    expect(sugerirHorario(disponibilidad)).toEqual({
      fecha: '2026-10-13',
      hora: '09:00',
    });
  });

  it('respeta el día y la hora preferidos si siguen libres', () => {
    expect(
      sugerirHorario(disponibilidad, { fecha: '2026-10-13', hora: '10:00' }),
    ).toEqual({ fecha: '2026-10-13', hora: '10:00' });
    expect(
      sugerirHorario(disponibilidad, { fecha: '2026-10-14', hora: '10:00' }),
    ).toEqual({ fecha: '2026-10-14', hora: '08:00' });
  });

  it('despuesDe descarta ese día (la inasistencia propone desde el siguiente)', () => {
    expect(sugerirHorario(disponibilidad, { despuesDe: '2026-10-13' })).toEqual(
      { fecha: '2026-10-14', hora: '08:00' },
    );
  });

  it('null si no queda ninguna hora', () => {
    expect(sugerirHorario([{ fecha: '2026-10-12', libres: [] }])).toBeNull();
  });
});

describe('calcularImc', () => {
  it('redondea a un decimal', () => {
    expect(calcularImc(60, 1.6)).toBe(23.4);
  });

  it('null si falta el peso o la talla', () => {
    expect(calcularImc(null, 1.6)).toBeNull();
    expect(calcularImc(60, null)).toBeNull();
    expect(calcularImc(60, 0)).toBeNull();
  });
});
