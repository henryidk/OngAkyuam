import {
  cifraAnonima,
  MUNICIPIO_FUERA,
  filtrarConsultas,
  resumirRango,
  resumirPeriodo,
  type ConsultaParaAgregado,
} from './indicadores';

function consulta(
  parcial: Partial<ConsultaParaAgregado> = {},
): ConsultaParaAgregado {
  return {
    fechaHora: new Date('2026-03-10T15:00:00.000Z'),
    usuariaId: 'u1',
    ninoId: null,
    fechaNacimiento: '1990-01-01',
    grupoEtnico: 'MAYA',
    municipio: 'COBAN',
    tipologias: ['FISICA'],
    esPrimera: false,
    ...parcial,
  };
}

const total = (
  filas: readonly { clave: string; total: number }[],
  clave: string,
) => filas.find((f) => f.clave === clave)?.total;

describe('indicadores de Medicina', () => {
  it('cuenta consultas, personas distintas (usuaria e hijos aparte) y primeras', () => {
    const periodo = resumirPeriodo([
      consulta({ esPrimera: true }),
      consulta({ fechaHora: new Date('2026-03-20T15:00:00.000Z') }),
      consulta({
        ninoId: 'n1',
        fechaNacimiento: '2020-01-01',
        esPrimera: true,
      }),
    ]);
    expect(periodo.consultas).toBe(3);
    expect(periodo.personasAtendidas).toBe(2);
    expect(periodo.primerasConsultas).toBe(2);
  });

  it('los desgloses traen todas las claves del catálogo, aunque valgan 0', () => {
    const vacio = resumirPeriodo([]);
    expect(vacio.desgloses.municipio.length).toBeGreaterThan(1);
    expect(vacio.desgloses.municipio.every((f) => f.total === 0)).toBe(true);
    expect(total(vacio.desgloses.municipio, MUNICIPIO_FUERA)).toBe(0);
  });

  it('una persona cuenta una vez por categoría y quien vive fuera va en un solo renglón', () => {
    const periodo = resumirPeriodo([
      consulta({ municipio: null }),
      consulta({ municipio: null, tipologias: ['FISICA'] }),
    ]);
    expect(total(periodo.desgloses.municipio, MUNICIPIO_FUERA)).toBe(1);
    expect(total(periodo.desgloses.tipologia, 'FISICA')).toBe(1);
  });

  it('el mes se corta en hora de Guatemala', () => {
    // 2026-04-01 03:00 UTC es todavía 31 de marzo en Guatemala.
    const { total, meses } = resumirRango(
      [consulta({ fechaHora: new Date('2026-04-01T03:00:00.000Z') })],
      '2026-03-01',
      '2026-04-30',
    );
    expect(total.consultas).toBe(1);
    expect(meses.map((m) => [m.mes, m.consultas])).toEqual([
      [3, 1],
      [4, 0],
    ]);
  });

  it('trae cada mes que toca el rango, aunque cruce de año y venga en cero', () => {
    const { meses } = resumirRango([], '2025-11-15', '2026-02-03');
    expect(meses.map((m) => `${m.anio}-${m.mes}`)).toEqual([
      '2025-11',
      '2025-12',
      '2026-1',
      '2026-2',
    ]);
    expect(meses.every((m) => m.consultas === 0)).toBe(true);
  });

  it('filtra por usuarias, por hijos/as y por primeras consultas', () => {
    const consultas = [
      consulta({ esPrimera: true }),
      consulta(),
      consulta({ ninoId: 'n1' }),
    ];
    const contar = (filtros: Parameters<typeof filtrarConsultas>[1]) =>
      filtrarConsultas(consultas, filtros).length;
    expect(contar({ persona: 'TODAS', soloPrimeras: false })).toBe(3);
    expect(contar({ persona: 'USUARIAS', soloPrimeras: false })).toBe(2);
    expect(contar({ persona: 'HIJOS', soloPrimeras: false })).toBe(1);
    expect(contar({ persona: 'TODAS', soloPrimeras: true })).toBe(1);
    expect(contar({ persona: 'HIJOS', soloPrimeras: true })).toBe(0);
  });

  it('cifraAnonima oculta 1 y 2, publica el 0 y desde 3', () => {
    expect(cifraAnonima(0)).toBe(0);
    expect(cifraAnonima(1)).toBe('<3');
    expect(cifraAnonima(2)).toBe('<3');
    expect(cifraAnonima(3)).toBe(3);
  });
});
