import { hijoDeFicha, type NinoConProcesos } from './hijos-ficha.mapper';

function nino(cambios: Partial<NinoConProcesos> = {}): NinoConProcesos {
  return {
    id: 'nino-1',
    consecutivo: 2,
    nombres: 'Ana',
    apellidos: 'Pérez López',
    fechaNacimiento: new Date('2021-07-02T00:00:00.000Z'),
    genero: 'MUJER',
    atencionesPsicologicas: [],
    ...cambios,
  };
}

function proceso(
  cambios: Partial<NinoConProcesos['atencionesPsicologicas'][number]> = {},
): NinoConProcesos['atencionesPsicologicas'][number] {
  return {
    id: 'proceso-1',
    consecutivo: 1,
    estado: 'SEGUIMIENTO',
    fechaCierre: null,
    psicologaAsignada: { nombreCompleto: 'Sofía Caal', puesto: 'PRACTICANTE' },
    citas: [],
    ...cambios,
  };
}

describe('hijoDeFicha', () => {
  it('sin procesos se puede abrir el primero, con su número de hijo/a', () => {
    const hijo = hijoDeFicha(nino(), '04-2026', true);

    expect(hijo).toMatchObject({
      numero: '04-2026.02',
      nombreCompleto: 'Ana Pérez López',
      genero: 'M',
      fechaNacimiento: '2021-07-02',
      procesoAbierto: null,
      ultimoCierre: null,
      puedeAbrirProceso: true,
      codigoProcesoNuevo: '04-2026.02',
    });
  });

  it('con un proceso abierto lo resume y no deja abrir otro', () => {
    const fechaHora = new Date('2026-10-30T16:00:00.000Z');
    const hijo = hijoDeFicha(
      nino({ atencionesPsicologicas: [proceso({ citas: [{ fechaHora }] })] }),
      '04-2026',
      true,
    );

    expect(hijo.procesoAbierto).toEqual({
      procesoId: 'proceso-1',
      codigo: '04-2026.02',
      etapa: 'SEGUIMIENTO',
      responsable: { nombreCompleto: 'Sofía Caal', puesto: 'PRACTICANTE' },
      proximaCita: fechaHora.toISOString(),
    });
    expect(hijo.puedeAbrirProceso).toBe(false);
  });

  it('con procesos cerrados informa el último cierre y numera el siguiente', () => {
    const hijo = hijoDeFicha(
      nino({
        atencionesPsicologicas: [
          proceso({
            id: 'p2',
            consecutivo: 2,
            estado: 'CIERRE',
            fechaCierre: new Date('2026-08-12T15:00:00.000Z'),
          }),
          proceso({
            id: 'p1',
            consecutivo: 1,
            estado: 'CIERRE',
            fechaCierre: new Date('2026-03-01T15:00:00.000Z'),
          }),
        ],
      }),
      '04-2026',
      true,
    );

    expect(hijo.ultimoCierre).toBe('2026-08-12T15:00:00.000Z');
    expect(hijo.codigoProcesoNuevo).toBe('04-2026.02 · Proceso 3');
    expect(hijo.puedeAbrirProceso).toBe(true);
  });

  it('si nadie del área tomó el expediente, no se abre desde la ficha', () => {
    expect(
      hijoDeFicha(nino({ genero: 'HOMBRE' }), '04-2026', false),
    ).toMatchObject({
      genero: 'H',
      puedeAbrirProceso: false,
    });
  });
});
