import {
  horasDeInicio,
  huecosLibres,
  type TramoOcupado,
} from './huecos-libres';

const h = (hora: number, minuto = 0) => hora * 60 + minuto;
const cita = (inicioMin: number, duracion: number): TramoOcupado => ({
  inicioMin,
  finMin: inicioMin + duracion,
});
const LUNES = 1;

describe('huecosLibres', () => {
  it.each<{
    caso: string;
    ocupados: TramoOcupado[];
    dia: number;
    ahora: number | null;
    esperado: [number, number][];
  }>([
    {
      caso: 'día vacío: la jornada completa, sin pausa de almuerzo',
      ocupados: [],
      dia: LUNES,
      ahora: null,
      esperado: [[h(8), h(17)]],
    },
    {
      caso: 'una cita parte el día en dos',
      ocupados: [cita(h(9), 60)],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(8), h(9)],
        [h(10), h(17)],
      ],
    },
    {
      caso: 'el mediodía se ofrece como cualquier hora',
      ocupados: [cita(h(11), 60), cita(h(13), 60)],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(8), h(11)],
        [h(12), h(13)],
        [h(14), h(17)],
      ],
    },
    {
      caso: 'citas solapadas cuentan como un solo bloque',
      ocupados: [cita(h(9), 60), cita(h(9, 30), 90)],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(8), h(9)],
        [h(11), h(17)],
      ],
    },
    {
      caso: 'un espacio menor al mínimo no se ofrece',
      ocupados: [cita(h(8), 60), cita(h(9, 15), 45)],
      dia: LUNES,
      ahora: null,
      esperado: [[h(10), h(17)]],
    },
    {
      caso: 'una cita fuera de horario no crea huecos fuera de él',
      ocupados: [cita(h(6), 60), cita(h(18), 60)],
      dia: LUNES,
      ahora: null,
      esperado: [[h(8), h(17)]],
    },
    {
      caso: 'hoy a media mañana arranca en el siguiente cuarto de hora',
      ocupados: [],
      dia: LUNES,
      ahora: h(10, 7),
      esperado: [[h(10, 15), h(17)]],
    },
    {
      caso: 'hoy antes de abrir arranca a la hora de apertura',
      ocupados: [],
      dia: LUNES,
      ahora: h(6),
      esperado: [[h(8), h(17)]],
    },
    {
      caso: 'hoy al final de la tarde ya no queda espacio suficiente',
      ocupados: [],
      dia: LUNES,
      ahora: h(16, 40),
      esperado: [],
    },
    { caso: 'sábado', ocupados: [], dia: 6, ahora: null, esperado: [] },
    { caso: 'domingo', ocupados: [], dia: 7, ahora: null, esperado: [] },
  ])('$caso', ({ ocupados, dia, ahora, esperado }) => {
    expect(huecosLibres(ocupados, dia, ahora)).toEqual(
      esperado.map(([desdeMin, hastaMin]) => ({ desdeMin, hastaMin })),
    );
  });

  it('no altera el arreglo de citas que recibe', () => {
    const ocupados = [cita(h(14), 45), cita(h(9), 45)];
    huecosLibres(ocupados, LUNES, null);
    expect(ocupados.map((tramo) => tramo.inicioMin)).toEqual([h(14), h(9)]);
  });
});

describe('horasDeInicio', () => {
  const hueco = (desdeMin: number, hastaMin: number) => ({
    desdeMin,
    hastaMin,
  });

  it('ofrece cada media hora donde cabe la cita completa', () => {
    expect(horasDeInicio([hueco(h(8), h(10))], 45, 30)).toEqual([
      '08:00',
      '08:30',
      '09:00',
    ]);
    expect(horasDeInicio([hueco(h(8), h(10))], 60, 30)).toEqual([
      '08:00',
      '08:30',
      '09:00',
    ]);
    expect(horasDeInicio([hueco(h(8), h(10))], 30, 30)).toEqual([
      '08:00',
      '08:30',
      '09:00',
      '09:30',
    ]);
  });

  it('un hueco que no arranca en punto se alinea a la siguiente media hora', () => {
    expect(horasDeInicio([hueco(h(9, 45), h(11))], 45, 30)).toEqual(['10:00']);
  });

  it('un hueco donde la cita no cabe no ofrece nada', () => {
    expect(horasDeInicio([hueco(h(9), h(9, 45))], 60, 30)).toEqual([]);
  });

  it('junta las horas de varios huecos en orden', () => {
    expect(
      horasDeInicio([hueco(h(8), h(9)), hueco(h(16), h(17))], 60, 30),
    ).toEqual(['08:00', '16:00']);
  });
});
