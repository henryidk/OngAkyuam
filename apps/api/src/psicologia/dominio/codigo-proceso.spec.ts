import { codigoProceso } from './codigo-proceso';

describe('codigoProceso', () => {
  it('antepone el número de proceso al número de expediente', () => {
    expect(codigoProceso(1, '05-2026')).toBe('P1-05-2026');
    expect(codigoProceso(2, '05-2026')).toBe('P2-05-2026');
  });
});
