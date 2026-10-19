import { etiquetaAtencion, etiquetaProceso } from '@akyuam/shared';

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
