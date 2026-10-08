import {
  PROCESO_POR_REASIGNAR,
  procesoCerradoDeColega,
  procesoLegible,
} from './acceso-expediente';

// La regla vive en la consulta: estas pruebas fijan su forma para que nadie la afloje sin querer.
describe('procesoLegible', () => {
  const colega = procesoCerradoDeColega('psicologa-a');

  it('admite solo dos caminos: el proceso propio o el cerrado de una colega', () => {
    expect(procesoLegible('psicologa-a')).toEqual({
      OR: [{ psicologaAsignadaId: 'psicologa-a' }, colega],
    });
  });

  it('del proceso de una colega exige que ya esté cerrado', () => {
    expect(colega.estado).toBe('CIERRE');
  });

  it('exige que el proceso tenga dueña y que no sea quien pregunta', () => {
    expect(colega.AND).toEqual([
      { psicologaAsignadaId: { not: null } },
      { psicologaAsignadaId: { not: 'psicologa-a' } },
    ]);
  });

  it('exige que quien pregunta atienda o haya atendido a la misma usuaria', () => {
    expect(colega.expediente).toEqual({
      usuaria: {
        expedientes: {
          some: {
            atencionesPsicologicas: {
              some: { psicologaAsignadaId: 'psicologa-a' },
            },
          },
        },
      },
    });
  });
});

describe('PROCESO_POR_REASIGNAR', () => {
  it('solo es de toda el área lo que sigue abierto y tiene a su psicóloga desactivada', () => {
    expect(PROCESO_POR_REASIGNAR).toEqual({
      estado: { not: 'CIERRE' },
      psicologaAsignada: { isActive: false },
    });
  });
});
