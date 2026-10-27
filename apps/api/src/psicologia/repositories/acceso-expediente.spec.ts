import {
  citaRegistrable,
  EXPEDIENTE_DE_PSICOLOGIA,
  EXPEDIENTE_TOMADO,
  PROCESO_LEGIBLE,
  PROCESO_POR_REASIGNAR,
  procesoAbiertoDePersona,
  procesoGestionable,
} from './acceso-expediente';

// La regla vive en la consulta: estas pruebas fijan su forma para que nadie la afloje sin querer.
describe('reglas de acceso de Psicología', () => {
  it('leer exige que Trabajo Social haya referido el expediente a Psicología', () => {
    expect(EXPEDIENTE_DE_PSICOLOGIA).toEqual({
      referidos: { some: { area: 'PSICOLOGIA' } },
    });
    expect(PROCESO_LEGIBLE).toEqual({ expediente: EXPEDIENTE_DE_PSICOLOGIA });
  });

  it('gestionar exige ser la responsable, además de poder leer', () => {
    expect(procesoGestionable('psicologa-a')).toEqual({
      psicologaAsignadaId: 'psicologa-a',
      expediente: EXPEDIENTE_DE_PSICOLOGIA,
    });
  });

  it('registrar una sesión exige haberla atendido y que el proceso siga abierto', () => {
    expect(citaRegistrable('psicologa-a')).toEqual({
      atendidoPorId: 'psicologa-a',
      atencion: {
        estado: { not: 'CIERRE' },
        expediente: EXPEDIENTE_DE_PSICOLOGIA,
      },
    });
  });

  it('abrir desde la ficha exige un expediente referido que alguien ya tomó', () => {
    expect(EXPEDIENTE_TOMADO).toEqual({
      referidos: { some: { area: 'PSICOLOGIA' } },
      atencionesPsicologicas: { some: { psicologaAsignadaId: { not: null } } },
    });
  });

  describe('procesoAbiertoDePersona', () => {
    it('de la usuaria, mira sus procesos propios en todos sus expedientes', () => {
      expect(
        procesoAbiertoDePersona({ usuariaId: 'u1', ninoId: null }),
      ).toEqual({
        estado: { not: 'CIERRE' },
        ninoId: null,
        expediente: { usuariaId: 'u1' },
      });
    });

    it('de un hijo/a, mira solo los suyos', () => {
      expect(
        procesoAbiertoDePersona({ usuariaId: 'u1', ninoId: 'n1' }),
      ).toEqual({ estado: { not: 'CIERRE' }, ninoId: 'n1' });
    });
  });

  it('solo es de toda el área lo que sigue abierto y tiene a su psicóloga desactivada', () => {
    expect(PROCESO_POR_REASIGNAR).toEqual({
      estado: { not: 'CIERRE' },
      psicologaAsignada: { isActive: false },
    });
  });
});
