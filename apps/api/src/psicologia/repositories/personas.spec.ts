import { personasParaAbrir } from './personas';

const USUARIA = {
  nombres: 'María',
  apellidos: 'López',
  fechaNacimiento: new Date('1990-01-15T00:00:00.000Z'),
};

function nino(id: string, consecutivo: number, atendidaPor?: string) {
  return {
    id,
    consecutivo,
    nombres: 'Juan',
    apellidos: 'Pérez López',
    fechaNacimiento: new Date('2018-03-12T00:00:00.000Z'),
    atencionesPsicologicas: atendidaPor
      ? [{ psicologaAsignada: { nombreCompleto: atendidaPor } }]
      : [],
  };
}

describe('personasParaAbrir', () => {
  it('pone a la usuaria primero y numera a cada hijo/a', () => {
    const personas = personasParaAbrir(
      {
        numero: '04-2026',
        usuaria: USUARIA,
        ninos: [nino('n1', 1), nino('n2', 2)],
      },
      undefined,
    );

    expect(personas.map(({ ninoId, numero }) => ({ ninoId, numero }))).toEqual([
      { ninoId: null, numero: '04-2026' },
      { ninoId: 'n1', numero: '04-2026.01' },
      { ninoId: 'n2', numero: '04-2026.02' },
    ]);
    expect(personas.every((persona) => persona.atendidaPor === null)).toBe(
      true,
    );
  });

  it('marca a quien ya tiene un proceso abierto con quién la atiende', () => {
    const [usuaria, hijo] = personasParaAbrir(
      {
        numero: '04-2026',
        usuaria: USUARIA,
        ninos: [nino('n1', 1, 'Ana Caal')],
      },
      { psicologaAsignada: { nombreCompleto: 'Sofía Tun' } },
    );

    expect(usuaria.atendidaPor).toBe('Sofía Tun');
    expect(hijo.atendidaPor).toBe('Ana Caal');
  });
});
