import {
  etiquetaAtencion,
  etiquetaProceso,
  separarNumeroInterno,
} from '@akyuam/shared';

describe('numeración visible (planaudiencias.md §3)', () => {
  it('el primer proceso del expediente se muestra solo con el número de expediente', () => {
    expect(etiquetaProceso('10-2026', 1)).toBe('10-2026');
    expect(etiquetaAtencion('10-2026', 1)).toBe('10-2026');
  });

  it('a partir del segundo agrega su número, sin letra de área', () => {
    expect(etiquetaProceso('10-2026', 2)).toBe('10-2026 · Proceso 2');
    expect(etiquetaAtencion('10-2026', 3)).toBe('10-2026 · Atención 3');
  });
});

describe('separarNumeroInterno (búsqueda por el No. interno completo, H1)', () => {
  it.each([
    ['10-2026 · Proceso 2', '10-2026', 2],
    ['  10-2026 · Proceso 2  ', '10-2026', 2],
    ['10-2026 proceso 2', '10-2026', 2],
    ['100-2026·Proceso 12', '100-2026', 12],
    ['10-2026 · Atención 3', '10-2026', 3],
    ['10-2026 · atencion 3', '10-2026', 3],
  ])('separa %p', (termino, expedienteNumero, consecutivo) => {
    expect(separarNumeroInterno(termino)).toEqual({
      expedienteNumero,
      consecutivo,
    });
  });

  it.each([
    '10-2026',
    'María López',
    '10-2026 · Proceso',
    '10-2026 · Proceso 0',
    'C-01-2026',
  ])('deja %p como búsqueda de texto normal', (termino) => {
    expect(separarNumeroInterno(termino)).toBeNull();
  });
});
