import { huecosLibres, type TramoOcupado } from './huecos-libres';

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
      caso: 'día vacío: mañana y tarde, sin el almuerzo',
      ocupados: [],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(8), h(12)],
        [h(13), h(17)],
      ],
    },
    {
      caso: 'una cita parte la mañana en dos',
      ocupados: [cita(h(9), 60)],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(8), h(9)],
        [h(10), h(12)],
        [h(13), h(17)],
      ],
    },
    {
      caso: 'citas solapadas cuentan como un solo bloque',
      ocupados: [cita(h(9), 60), cita(h(9, 30), 90)],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(8), h(9)],
        [h(11), h(12)],
        [h(13), h(17)],
      ],
    },
    {
      caso: 'un espacio menor al mínimo no se ofrece',
      ocupados: [cita(h(8), 60), cita(h(9, 30), 45)],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(10, 15), h(12)],
        [h(13), h(17)],
      ],
    },
    {
      caso: 'una cita que cruza el almuerzo alarga el bloqueo',
      ocupados: [cita(h(11, 30), 120)],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(8), h(11, 30)],
        [h(13, 30), h(17)],
      ],
    },
    {
      caso: 'una cita fuera de horario no crea huecos fuera de él',
      ocupados: [cita(h(6), 60), cita(h(18), 60)],
      dia: LUNES,
      ahora: null,
      esperado: [
        [h(8), h(12)],
        [h(13), h(17)],
      ],
    },
    {
      caso: 'hoy a media mañana arranca en el siguiente cuarto de hora',
      ocupados: [],
      dia: LUNES,
      ahora: h(10, 7),
      esperado: [
        [h(10, 15), h(12)],
        [h(13), h(17)],
      ],
    },
    {
      caso: 'hoy antes de abrir arranca a la hora de apertura',
      ocupados: [],
      dia: LUNES,
      ahora: h(6),
      esperado: [
        [h(8), h(12)],
        [h(13), h(17)],
      ],
    },
    {
      caso: 'hoy al final de la tarde ya no queda espacio suficiente',
      ocupados: [],
      dia: LUNES,
      ahora: h(16, 20),
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
