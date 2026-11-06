import { rangoEdadInformeMedica } from '@akyuam/shared';
import {
  armarInformeAtencion,
  type ConsultaParaInforme,
} from './informe-atencion';

/** Consulta de la usuaria "u1", maya, de 30 años el 10 de marzo de 2026, primer ingreso. */
function consulta(
  cambios: Partial<ConsultaParaInforme> = {},
): ConsultaParaInforme {
  return {
    // 10:00 en Guatemala.
    fechaHora: new Date('2026-03-10T16:00:00.000Z'),
    modalidad: 'PRESENCIAL',
    usuariaId: 'u1',
    hijoId: null,
    sexo: 'MUJER',
    fechaNacimiento: '1996-01-01',
    grupoEtnico: 'MAYA',
    ingresoUsuaria: 'PRIMER_INGRESO',
    usuariaAtendidaAntes: false,
    ingresoAlbergue: null,
    egresoAlbergue: null,
    ...cambios,
  };
}

function fila(informe: ReturnType<typeof armarInformeAtencion>, clave: string) {
  const encontrada = informe.filas.find((f) => f.clave === clave);
  if (!encontrada) throw new Error(`Sin renglón ${clave}`);
  return encontrada;
}

describe('rangoEdadInformeMedica', () => {
  it.each([
    [0, '0-15'],
    [15, '0-15'],
    [16, '16-30'],
    [30, '16-30'],
    [31, '31-45'],
    [45, '31-45'],
    [46, '46+'],
    [90, '46+'],
  ])('%i años → %s', (edad, rango) => {
    expect(rangoEdadInformeMedica(edad)).toBe(rango);
  });
});

describe('armarInformeAtencion', () => {
  it('sin consultas trae los cinco renglones en cero y en el orden del formato', () => {
    const informe = armarInformeAtencion([]);
    expect(informe.filas.map((f) => f.clave)).toEqual([
      'NUEVO_INGRESO',
      'SEGUIMIENTO',
      'INDIRECTOS',
      'TELEFONICA',
      'ALBERGADAS',
    ]);
    expect(informe.totales.total).toBe(0);
    expect(informe.totales.etnia).toEqual({
      MAYA: 0,
      XINCA: 0,
      GARIFUNA: 0,
      LADINO: 0,
      OTRO: 0,
    });
  });

  it('cuenta una vez a la usuaria de nuevo ingreso aunque tenga varias consultas', () => {
    const informe = armarInformeAtencion([
      consulta(),
      consulta({ fechaHora: new Date('2026-03-20T16:00:00.000Z') }),
    ]);
    expect(fila(informe, 'NUEVO_INGRESO')).toMatchObject({
      mujer: 1,
      hombre: 0,
      total: 1,
      etnia: { MAYA: 1 },
      edad: { '16-30': 1 },
    });
    expect(fila(informe, 'SEGUIMIENTO').total).toBe(0);
  });

  it('es seguimiento si la referencia no es su primer ingreso o ya se le atendió antes', () => {
    const informe = armarInformeAtencion([
      consulta({ usuariaId: 'u1', ingresoUsuaria: 'SEGUIMIENTO' }),
      consulta({ usuariaId: 'u2', usuariaAtendidaAntes: true }),
      consulta({ usuariaId: 'u3', grupoEtnico: 'XINCA' }),
    ]);
    expect(fila(informe, 'SEGUIMIENTO').total).toBe(2);
    expect(fila(informe, 'NUEVO_INGRESO')).toMatchObject({
      total: 1,
      etnia: { XINCA: 1, MAYA: 0 },
    });
  });

  it('si en el periodo fue seguimiento y nuevo ingreso, cuenta solo como nuevo ingreso', () => {
    const informe = armarInformeAtencion([
      consulta({ ingresoUsuaria: 'SEGUIMIENTO' }),
      consulta({ fechaHora: new Date('2026-03-20T16:00:00.000Z') }),
    ]);
    expect(fila(informe, 'NUEVO_INGRESO').total).toBe(1);
    expect(fila(informe, 'SEGUIMIENTO').total).toBe(0);
  });

  it('indirectos: solo hijos/as de madres de nuevo ingreso, por sexo y con la etnia de la madre', () => {
    const hijo = {
      fechaNacimiento: '2018-05-01',
      grupoEtnico: 'GARIFUNA' as const,
    };
    const informe = armarInformeAtencion([
      consulta({ usuariaId: 'u1', grupoEtnico: 'GARIFUNA' }),
      consulta({ usuariaId: 'u1', hijoId: 'h1', sexo: 'HOMBRE', ...hijo }),
      consulta({
        usuariaId: 'u1',
        hijoId: 'h1',
        sexo: 'HOMBRE',
        ...hijo,
        fechaHora: new Date('2026-03-25T16:00:00.000Z'),
      }),
      consulta({ usuariaId: 'u1', hijoId: 'h2', sexo: 'MUJER', ...hijo }),
      // Madre de seguimiento: su hija no entra.
      consulta({ usuariaId: 'u2', ingresoUsuaria: 'SEGUIMIENTO' }),
      consulta({
        usuariaId: 'u2',
        ingresoUsuaria: 'SEGUIMIENTO',
        hijoId: 'h3',
        sexo: 'MUJER',
      }),
      // Madre que no tuvo consulta propia en el periodo: tampoco.
      consulta({ usuariaId: 'u3', hijoId: 'h4', sexo: 'MUJER' }),
    ]);
    expect(fila(informe, 'INDIRECTOS')).toMatchObject({
      mujer: 1,
      hombre: 1,
      total: 2,
      etnia: { GARIFUNA: 2 },
      edad: { '0-15': 2 },
    });
  });

  it('las telefónicas se cuentan por consulta, de usuarias e hijos/as', () => {
    const informe = armarInformeAtencion([
      consulta({ modalidad: 'TELEFONICA' }),
      consulta({
        modalidad: 'TELEFONICA',
        fechaHora: new Date('2026-03-20T16:00:00.000Z'),
      }),
      consulta({
        modalidad: 'TELEFONICA',
        hijoId: 'h1',
        sexo: 'HOMBRE',
        fechaNacimiento: '2020-01-01',
      }),
      consulta({ usuariaId: 'u2' }),
    ]);
    expect(fila(informe, 'TELEFONICA')).toMatchObject({
      mujer: 2,
      hombre: 1,
      total: 3,
      edad: { '0-15': 1, '16-30': 2 },
    });
  });

  it('albergadas: usuarias con una consulta propia dentro de su estancia en el albergue', () => {
    const informe = armarInformeAtencion([
      // Dentro, sin egreso.
      consulta({ usuariaId: 'u1', ingresoAlbergue: '2026-03-01' }),
      // El día de egreso cuenta.
      consulta({
        usuariaId: 'u2',
        ingresoAlbergue: '2026-02-01',
        egresoAlbergue: '2026-03-10',
      }),
      // Ya había egresado.
      consulta({
        usuariaId: 'u3',
        ingresoAlbergue: '2026-01-01',
        egresoAlbergue: '2026-03-09',
      }),
      // Ingresó después de la consulta.
      consulta({ usuariaId: 'u4', ingresoAlbergue: '2026-03-11' }),
      // Un hijo/a en el albergue no cuenta como usuaria albergada.
      consulta({
        usuariaId: 'u5',
        hijoId: 'h1',
        ingresoAlbergue: '2026-03-01',
      }),
    ]);
    expect(fila(informe, 'ALBERGADAS').total).toBe(2);
  });

  it('la edad es la del día de la primera consulta del periodo, en hora de Guatemala', () => {
    // Cumple 31 el 2026-03-10; la primera consulta fue el 9 a las 23:30 de Guatemala.
    const informe = armarInformeAtencion([
      consulta({
        fechaNacimiento: '1995-03-10',
        fechaHora: new Date('2026-03-11T16:00:00.000Z'),
      }),
      consulta({
        fechaNacimiento: '1995-03-10',
        fechaHora: new Date('2026-03-10T05:30:00.000Z'),
      }),
    ]);
    expect(fila(informe, 'NUEVO_INGRESO').edad).toMatchObject({
      '16-30': 1,
      '31-45': 0,
    });
  });

  it('los totales suman los renglones', () => {
    const informe = armarInformeAtencion([
      consulta({ modalidad: 'TELEFONICA', ingresoAlbergue: '2026-01-01' }),
      consulta({ usuariaId: 'u2', ingresoUsuaria: 'SEGUIMIENTO' }),
    ]);
    // u1: nuevo ingreso, telefónica y albergada; u2: seguimiento.
    expect(informe.totales).toMatchObject({ mujer: 4, hombre: 0, total: 4 });
    expect(informe.totales.etnia.MAYA).toBe(4);
  });
});
