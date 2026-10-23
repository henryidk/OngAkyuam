import { buscarHistorialConsultasMedicaSchema } from '@akyuam/shared';

describe('buscarHistorialConsultasMedicaSchema (planconsultasmedica.md §2.2)', () => {
  const RANGO = { desde: '2026-01-01', hasta: '2026-01-31' };

  it('acepta un rango sin búsqueda', () => {
    expect(buscarHistorialConsultasMedicaSchema.parse(RANGO)).toEqual(RANGO);
  });

  it('acepta un rango de un solo día', () => {
    const dia = { desde: '2026-03-10', hasta: '2026-03-10' };
    expect(buscarHistorialConsultasMedicaSchema.safeParse(dia).success).toBe(
      true,
    );
  });

  it('recorta la búsqueda e ignora la de un solo carácter', () => {
    expect(
      buscarHistorialConsultasMedicaSchema.parse({ ...RANGO, q: '  Ana  ' }).q,
    ).toBe('Ana');
    expect(
      buscarHistorialConsultasMedicaSchema.parse({ ...RANGO, q: 'A' }).q,
    ).toBeUndefined();
  });

  it('rechaza un rango invertido', () => {
    expect(
      buscarHistorialConsultasMedicaSchema.safeParse({
        desde: '2026-02-01',
        hasta: '2026-01-31',
      }).success,
    ).toBe(false);
  });

  it('acepta 365 días y rechaza 366 (acota cada barrido)', () => {
    expect(
      buscarHistorialConsultasMedicaSchema.safeParse({
        desde: '2026-01-01',
        hasta: '2027-01-01',
      }).success,
    ).toBe(true);
    expect(
      buscarHistorialConsultasMedicaSchema.safeParse({
        desde: '2026-01-01',
        hasta: '2027-01-02',
      }).success,
    ).toBe(false);
  });

  it.each([
    { desde: '2026-02-30', hasta: '2026-03-01' },
    { desde: '01/01/2026', hasta: '2026-01-31' },
    { hasta: '2026-01-31' },
    { ...RANGO, q: 'x'.repeat(81) },
    { ...RANGO, cursor: 'c'.repeat(201) },
  ])('rechaza %p', (entrada) => {
    expect(
      buscarHistorialConsultasMedicaSchema.safeParse(entrada).success,
    ).toBe(false);
  });
});
