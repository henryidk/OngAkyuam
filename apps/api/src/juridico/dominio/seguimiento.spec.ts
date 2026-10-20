import {
  anioDeFecha,
  carteraDe,
  esDeSeguimiento,
  etiquetaCartera,
} from '@akyuam/shared';

const ANIO = 2026;

describe('cartera de Jurídico (planaudiencias.md §2 y §8.6)', () => {
  it('lee el año de la fecha de calendario sin pasar por Date', () => {
    expect(anioDeFecha('2025-12-31')).toBe(2025);
    expect(anioDeFecha('2026-01-01')).toBe(2026);
  });

  it('el 31/12 del año anterior y abierto es seguimiento; el 01/01 no lo es', () => {
    expect(
      esDeSeguimiento({ fechaInicio: '2025-12-31', abierto: true }, ANIO),
    ).toBe(true);
    expect(
      esDeSeguimiento({ fechaInicio: '2026-01-01', abierto: true }, ANIO),
    ).toBe(false);
  });

  it('un proceso de un año anterior ya cerrado no es seguimiento', () => {
    expect(
      esDeSeguimiento({ fechaInicio: '2024-03-10', abierto: false }, ANIO),
    ).toBe(false);
  });

  it.each([
    [{ fechaInicio: '2026-05-02', abierto: true }, 'ANIO', '2026'],
    [{ fechaInicio: '2026-05-02', abierto: false }, 'ANIO', '2026'],
    [
      { fechaInicio: '2024-03-10', abierto: true },
      'SEGUIMIENTO',
      'Seguimiento (2024)',
    ],
    [{ fechaInicio: '2024-03-10', abierto: false }, null, ''],
  ])('%p → %p / %p', (datos, cartera, etiqueta) => {
    expect(carteraDe(datos, ANIO)).toBe(cartera);
    expect(etiquetaCartera(datos, ANIO)).toBe(etiqueta);
  });
});
