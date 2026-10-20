import { parseLocalGT } from '@akyuam/shared';
import { problemaHorarioAgenda } from './horario-audiencia';

const ahora = new Date(parseLocalGT('2026-10-21T10:00').getTime() + 17_000);

describe('problemaHorarioAgenda', () => {
  it('rechaza el pasado, aunque sea un minuto', () => {
    expect(problemaHorarioAgenda(parseLocalGT('2026-10-21T09:59'), ahora)).toBe(
      'NO_ES_FUTURO',
    );
  });

  it('rechaza el mismo minuto que ya está corriendo', () => {
    expect(problemaHorarioAgenda(parseLocalGT('2026-10-21T10:00'), ahora)).toBe(
      'NO_ES_FUTURO',
    );
  });

  it('acepta el minuto siguiente', () => {
    expect(
      problemaHorarioAgenda(parseLocalGT('2026-10-21T10:01'), ahora),
    ).toBeNull();
  });

  it('acepta hasta el mismo día dentro de 3 años y rechaza el siguiente', () => {
    expect(
      problemaHorarioAgenda(parseLocalGT('2029-10-21T23:59'), ahora),
    ).toBeNull();
    expect(problemaHorarioAgenda(parseLocalGT('2029-10-22T00:00'), ahora)).toBe(
      'DEMASIADO_LEJOS',
    );
  });

  it('un 29 de febrero sin pareja en el año límite cae entre el 28/02 y el 01/03', () => {
    const bisiesto = parseLocalGT('2028-02-29T10:00');
    expect(
      problemaHorarioAgenda(parseLocalGT('2031-02-28T09:00'), bisiesto),
    ).toBeNull();
    expect(
      problemaHorarioAgenda(parseLocalGT('2031-03-01T09:00'), bisiesto),
    ).toBe('DEMASIADO_LEJOS');
  });
});
