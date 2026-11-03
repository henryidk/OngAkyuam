import { consecutivoSiguiente, consecutivoTrasMaximo } from './consecutivo';

describe('consecutivoSiguiente', () => {
  it('sin nada registrado empieza en 1', () => {
    expect(consecutivoSiguiente([])).toBe(1);
  });

  it('sigue al mayor aunque haya huecos o vengan desordenados', () => {
    expect(consecutivoSiguiente([3, 1])).toBe(4);
    expect(consecutivoSiguiente([1, 2, 5])).toBe(6);
  });
});

describe('consecutivoTrasMaximo', () => {
  it('con el máximo de un aggregate: null es que no hay ninguno', () => {
    expect(consecutivoTrasMaximo(null)).toBe(1);
    expect(consecutivoTrasMaximo(9)).toBe(10);
  });
});
