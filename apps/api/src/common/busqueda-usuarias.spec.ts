import { BadRequestException } from '@nestjs/common';
import { interpretarBusqueda } from './busqueda-usuarias';

describe('interpretarBusqueda', () => {
  it.each([
    ['05-2026', '05-2026'],
    ['5-2026', '05-2026'],
    ['100-2026', '100-2026'],
  ])('"%s" busca el expediente %s', (termino, valor) => {
    expect(interpretarBusqueda(termino)).toEqual({
      tipo: 'numeroExpediente',
      valor,
    });
  });

  it.each([
    ['04-2026.01', '04-2026', 1],
    ['4-2026.1', '04-2026', 1],
    ['04-2026.10', '04-2026', 10],
  ])(
    'el número de un hijo/a "%s" busca su expediente %s y su consecutivo %p',
    (termino, valor, ninoConsecutivo) => {
      expect(interpretarBusqueda(termino)).toEqual({
        tipo: 'numeroExpediente',
        valor,
        ninoConsecutivo,
      });
    },
  );

  it('un DPI de 13 dígitos se busca exacto', () => {
    expect(interpretarBusqueda('1234567890123')).toEqual({
      tipo: 'dpi',
      valor: '1234567890123',
    });
  });

  it('lo demás es un nombre, con al menos 3 letras', () => {
    expect(interpretarBusqueda('Ana López')).toEqual({
      tipo: 'nombre',
      valor: 'Ana López',
    });
    expect(() => interpretarBusqueda('An')).toThrow(BadRequestException);
  });

  it('sin término no filtra', () => {
    expect(interpretarBusqueda(undefined)).toBeUndefined();
  });
});
