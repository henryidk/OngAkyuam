import {
  etiquetaAtencion,
  etiquetaProceso,
  etiquetaProcesoPsicologia,
  formatoNumeroExpediente,
  normalizarNumeroExpediente,
  numeroPersona,
  partesCodigo,
  separarNumeroInterno,
  textoCodigo,
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
    ['5-2026 · Proceso 2', '05-2026', 2],
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
    // En Jurídico la unidad es "Proceso": "Atención" no es un No. interno suyo.
    '10-2026 · Atención 3',
  ])('deja %p como búsqueda de texto normal', (termino) => {
    expect(separarNumeroInterno(termino)).toBeNull();
  });

  it.each([
    ['10-2026 · Atención 3', '10-2026', 3],
    ['5-2026 · atencion 3', '05-2026', 3],
  ])('en Médica separa %p', (termino, expedienteNumero, consecutivo) => {
    expect(separarNumeroInterno(termino, 'atencion')).toEqual({
      expedienteNumero,
      consecutivo,
    });
  });

  it('en Médica "Proceso" no es un No. interno', () => {
    expect(separarNumeroInterno('10-2026 · Proceso 2', 'atencion')).toBeNull();
  });
});

describe('número de expediente', () => {
  it.each([
    [5, 2026, '05-2026'],
    [10, 2026, '10-2026'],
    [100, 2026, '100-2026'],
  ])('%p del año %p es %p', (consecutivo, anio, numero) => {
    expect(formatoNumeroExpediente(consecutivo, anio)).toBe(numero);
  });

  it.each([
    ['5-2026', '05-2026'],
    [' 05-2026 ', '05-2026'],
    ['100-2026', '100-2026'],
    ['05-26', null],
    ['05-2026.01', null],
  ])('normaliza %p como %p', (texto, numero) => {
    expect(normalizarNumeroExpediente(texto)).toBe(numero);
  });
});

describe('número de un hijo/a', () => {
  it.each([
    [1, '04-2026.01'],
    [10, '04-2026.10'],
  ])('el hijo/a %p es %p', (consecutivo, numero) => {
    expect(numeroPersona('04-2026', consecutivo)).toBe(numero);
  });

  it('su segundo proceso en Psicología lleva su número y el del proceso', () => {
    expect(etiquetaProcesoPsicologia('04-2026', 2, 10)).toBe(
      '04-2026.10 · Proceso 2',
    );
  });
});

describe('partesCodigo', () => {
  it.each([
    ['05-2026', '05-2026', null, null],
    ['05-2026 · Proceso 2', '05-2026', 'Proceso 2', null],
    ['100-2026 · Atención 3', '100-2026', 'Atención 3', null],
    ['04-2026.01', '04-2026.01', null, '.01'],
    ['04-2026.10 · Proceso 2', '04-2026.10', 'Proceso 2', '.10'],
  ])('separa %p', (codigo, numero, unidad, sufijoPersona) => {
    expect(partesCodigo(codigo)).toEqual({ numero, unidad, sufijoPersona });
  });
});

describe('textoCodigo', () => {
  it('antepone la palabra solo si el código no la trae', () => {
    expect(textoCodigo('Proceso', '04-2026')).toBe('Proceso 04-2026');
    expect(textoCodigo('Proceso', '04-2026 · Proceso 2')).toBe(
      '04-2026 · Proceso 2',
    );
    expect(textoCodigo('Atención', '10-2026 · Atención 2')).toBe(
      '10-2026 · Atención 2',
    );
    expect(textoCodigo('Proceso', '04-2026.01')).toBe('Proceso 04-2026.01');
  });
});

describe('números de expediente largos', () => {
  it('acepta un consecutivo de más de cuatro dígitos, como la base', () => {
    expect(normalizarNumeroExpediente('12345-2026')).toBe('12345-2026');
    expect(separarNumeroInterno('12345678-2099 · Proceso 2')).toEqual({
      expedienteNumero: '12345678-2099',
      consecutivo: 2,
    });
  });
});
