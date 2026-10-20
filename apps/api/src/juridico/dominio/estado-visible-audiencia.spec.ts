import { parseLocalGT } from '@akyuam/shared';
import { estadoVisibleAudiencia } from './estado-visible-audiencia';

const ahora = parseLocalGT('2026-10-21T10:00');

describe('estadoVisibleAudiencia', () => {
  it('una programada de otro día futuro es Próxima', () => {
    expect(
      estadoVisibleAudiencia(
        'PROGRAMADA',
        parseLocalGT('2026-10-22T09:00'),
        ahora,
      ),
    ).toBe('PROXIMA');
  });

  it('una programada de hoy que todavía no empieza es Hoy', () => {
    expect(
      estadoVisibleAudiencia(
        'PROGRAMADA',
        parseLocalGT('2026-10-21T15:00'),
        ahora,
      ),
    ).toBe('HOY');
  });

  it('una programada que ya empezó es Pendiente de resultado', () => {
    expect(
      estadoVisibleAudiencia(
        'PROGRAMADA',
        parseLocalGT('2026-10-21T10:00'),
        ahora,
      ),
    ).toBe('PENDIENTE_RESULTADO');
    expect(
      estadoVisibleAudiencia(
        'PROGRAMADA',
        parseLocalGT('2026-10-20T09:00'),
        ahora,
      ),
    ).toBe('PENDIENTE_RESULTADO');
  });

  it('"Hoy" se cuenta en Guatemala: las 19:00 GT ya son el día siguiente en UTC', () => {
    const tarde = parseLocalGT('2026-12-31T08:00');
    const audiencia = parseLocalGT('2026-12-31T19:00');
    expect(audiencia.toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(estadoVisibleAudiencia('PROGRAMADA', audiencia, tarde)).toBe('HOY');
  });

  it.each(['REALIZADA', 'NO_REALIZADA', 'CANCELADA', 'REPROGRAMADA'] as const)(
    '%s se muestra tal cual',
    (estado) => {
      expect(
        estadoVisibleAudiencia(estado, parseLocalGT('2026-10-22T09:00'), ahora),
      ).toBe(estado);
    },
  );
});
