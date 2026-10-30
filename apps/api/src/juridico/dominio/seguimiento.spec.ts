import { anioDeFecha, esDeSeguimiento } from '@akyuam/shared';

const ANIO = 2026;

describe('carpetas por año de Jurídico', () => {
  it('lee el año de la fecha de calendario sin pasar por Date', () => {
    expect(anioDeFecha('2025-12-31')).toBe(2025);
    expect(anioDeFecha('2026-01-01')).toBe(2026);
  });

  it('un expediente de un año anterior con el proceso abierto es seguimiento', () => {
    expect(esDeSeguimiento({ anioExpediente: 2014, abierto: true }, ANIO)).toBe(
      true,
    );
    expect(esDeSeguimiento({ anioExpediente: 2025, abierto: true }, ANIO)).toBe(
      true,
    );
  });

  it('un expediente de este año no es seguimiento, aunque el proceso siga abierto', () => {
    expect(esDeSeguimiento({ anioExpediente: 2026, abierto: true }, ANIO)).toBe(
      false,
    );
  });

  it('un proceso ya cerrado no es seguimiento', () => {
    expect(
      esDeSeguimiento({ anioExpediente: 2014, abierto: false }, ANIO),
    ).toBe(false);
  });

  it('el proceso abierto en 2026 que sigue en 2027 pasa a ser seguimiento, sin cambiar de carpeta', () => {
    const proceso = { anioExpediente: 2026, abierto: true };
    expect(esDeSeguimiento(proceso, 2026)).toBe(false);
    expect(esDeSeguimiento(proceso, 2027)).toBe(true);
  });
});
