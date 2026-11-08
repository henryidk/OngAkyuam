import {
  citaPorRegistrar,
  citaRegistrableEnAgenda,
  citaYaEmpezo,
} from '@akyuam/shared';

// Miércoles 14/10/2026, 09:00 en Guatemala (UTC-6).
const AHORA = new Date('2026-10-14T15:00:00.000Z');

describe('regla compartida de registro de citas (Medicina y Psicología)', () => {
  it('una cita empezó cuando su inicio es ahora o antes', () => {
    expect(citaYaEmpezo({ inicio: '2026-10-14T15:00:00.000Z' }, AHORA)).toBe(
      true,
    );
    expect(citaYaEmpezo({ inicio: '2026-10-14T15:00:01.000Z' }, AHORA)).toBe(
      false,
    );
  });

  it.each([
    ['ya empezó', '2026-10-14T14:30:00.000Z', true, true],
    ['de días anteriores', '2026-10-09T15:00:00.000Z', true, true],
    ['más tarde hoy', '2026-10-14T20:00:00.000Z', false, true],
    // 23:30 de hoy en Guatemala es 05:30 UTC de mañana: sigue siendo hoy.
    [
      'a las 23:30 de hoy en Guatemala',
      '2026-10-15T05:30:00.000Z',
      false,
      true,
    ],
    // 00:30 de mañana en Guatemala.
    ['mañana', '2026-10-15T06:30:00.000Z', false, false],
    ['la semana que viene', '2026-10-21T15:00:00.000Z', false, false],
  ] as const)(
    'programada %s → por registrar %p, registrable en la Agenda %p',
    (_caso, inicio, porRegistrar, enAgenda) => {
      const cita = { programada: true, inicio };
      expect(citaPorRegistrar(cita, AHORA)).toBe(porRegistrar);
      expect(citaRegistrableEnAgenda(cita, AHORA)).toBe(enAgenda);
    },
  );

  it('una cita que ya no está programada no se registra en ningún lado', () => {
    const cita = { programada: false, inicio: '2026-10-14T14:00:00.000Z' };
    expect(citaPorRegistrar(cita, AHORA)).toBe(false);
    expect(citaRegistrableEnAgenda(cita, AHORA)).toBe(false);
  });
});
