import {
  calcularImc,
  limiteAgendaMedica,
  sugerirHorario,
} from '@akyuam/shared';
import { exigirInicioValido } from '../compartido/validar-horario';
import {
  bloquesDeCita,
  bloquesOcupadosPorDia,
  dentroDeHorario,
  diasHabilesEntre,
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

  it('diasHabilesEntre salta el fin de semana e incluye ambos extremos', () => {
    expect(diasHabilesEntre('2026-10-16', '2026-10-20')).toEqual([
      '2026-10-16',
      '2026-10-19',
      '2026-10-20',
    ]);
    expect(diasHabilesEntre('2026-10-17', '2026-10-18')).toEqual([]);
  });

  it('limiteAgendaMedica: un mes de calendario, ajustado al fin de mes', () => {
    expect(limiteAgendaMedica('2026-10-27')).toBe('2026-11-27');
    expect(limiteAgendaMedica('2027-01-31')).toBe('2027-02-28');
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

  it('bloquesDeCita: un bloque de 30 min por cada media hora de duración', () => {
    expect(bloquesDeCita('09:00')).toEqual(['09:00']);
    expect(bloquesDeCita('09:00', 60)).toEqual(['09:00', '09:30']);
    expect(bloquesDeCita('09:30', 90)).toEqual(['09:30', '10:00', '10:30']);
  });

  it('una cita larga tiene que terminar a más tardar a las 17:00', () => {
    expect(dentroDeHorario(inicioCita(LUNES, '15:30'), 90)).toBe(true);
    expect(dentroDeHorario(inicioCita(LUNES, '16:00'), 60)).toBe(true);
    expect(dentroDeHorario(inicioCita(LUNES, '16:00'), 90)).toBe(false);
    expect(dentroDeHorario(inicioCita(LUNES, '16:30'), 60)).toBe(false);
  });

  it('bloquesOcupadosPorDia marca todos los bloques de cada cita, por día', () => {
    const porDia = bloquesOcupadosPorDia([
      { inicio: inicioCita(LUNES, '09:00'), duracionMin: 90 },
      { inicio: inicioCita(LUNES, '14:00'), duracionMin: 30 },
      { inicio: inicioCita('2026-10-13', '08:00'), duracionMin: 60 },
    ]);
    expect([...(porDia.get(LUNES) ?? [])].sort()).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '14:00',
    ]);
    expect([...(porDia.get('2026-10-13') ?? [])].sort()).toEqual([
      '08:00',
      '08:30',
    ]);
  });

  it('horasLibres con duración exige bloques seguidos libres y terminar a tiempo', () => {
    const ahora = inicioCita(LUNES, '07:00');
    // Ocupado 09:00–10:30 (una visita de 1 h 30) y 15:00–15:30.
    const ocupadas = bloquesOcupadosPorDia([
      { inicio: inicioCita(LUNES, '09:00'), duracionMin: 90 },
      { inicio: inicioCita(LUNES, '15:00'), duracionMin: 30 },
    ]).get(LUNES)!;
    const libres60 = horasLibres(LUNES, ocupadas, ahora, 60);
    // 08:30 chocaría con 09:00; 14:30 con 15:00; 16:30 terminaría a las 17:30.
    expect(libres60).toContain('08:00');
    expect(libres60).not.toContain('08:30');
    expect(libres60).not.toContain('09:30');
    expect(libres60).toContain('10:30');
    expect(libres60).not.toContain('14:30');
    expect(libres60).toContain('15:30');
    expect(libres60).toContain('16:00');
    expect(libres60).not.toContain('16:30');
    // Con 1 h 30 la última posible es 15:30.
    const libres90 = horasLibres(LUNES, ocupadas, ahora, 90);
    expect(libres90).toContain('15:30');
    expect(libres90).not.toContain('16:00');
    // 13:30 termina justo a las 15:00; 14:00 chocaría con la de las 15:00.
    expect(libres90).toContain('13:30');
    expect(libres90).not.toContain('14:00');
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
    // Con duración: 16:00 sirve para 1 h pero no para 1 h 30.
    expect(() =>
      exigirInicioValido('2026-10-12T16:00', ahora, 60),
    ).not.toThrow();
    expect(() => exigirInicioValido('2026-10-12T16:00', ahora, 90)).toThrow();
  });

  it('exigirInicioValido acepta hasta un mes adelante y rechaza lo posterior', () => {
    const ahora = inicioCita(LUNES, '10:00');
    // 12 de noviembre (jueves) es el límite exacto: entra completo.
    expect(() => exigirInicioValido('2026-11-12T16:30', ahora)).not.toThrow();
    expect(() => exigirInicioValido('2026-11-13T08:00', ahora)).toThrow(
      'Solo se puede agendar hasta un mes adelante',
    );
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
