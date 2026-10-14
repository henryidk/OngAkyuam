import {
  cifraAnonima,
  MUNICIPIO_FUERA,
  resumirAnio,
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
    grupoEtnico: 'MAYA_QECHI',
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
    const { anual, meses } = resumirAnio([
      consulta({ fechaHora: new Date('2026-04-01T03:00:00.000Z') }),
    ]);
    expect(anual.consultas).toBe(1);
    expect(meses).toHaveLength(12);
    expect(meses[2].consultas).toBe(1);
    expect(meses[3].consultas).toBe(0);
  });

  it('cifraAnonima oculta 1 y 2, publica el 0 y desde 3', () => {
    expect(cifraAnonima(0)).toBe(0);
    expect(cifraAnonima(1)).toBe('<3');
    expect(cifraAnonima(2)).toBe('<3');
    expect(cifraAnonima(3)).toBe(3);
  });
});
