import { esNovedadParaPsicologia } from './avisos-psicologia.listener';

describe('esNovedadParaPsicologia', () => {
  it('avisa de una referencia a Psicología', () => {
    expect(
      esNovedadParaPsicologia({
        accion: 'EXPEDIENTE_REFERIDO',
        detalles: { area: 'PSICOLOGIA' },
      }),
    ).toBe(true);
  });

  it('no avisa de una referencia a otra área', () => {
    expect(
      esNovedadParaPsicologia({
        accion: 'EXPEDIENTE_REFERIDO',
        detalles: { area: 'JURIDICO' },
      }),
    ).toBe(false);
    expect(esNovedadParaPsicologia({ accion: 'EXPEDIENTE_REFERIDO' })).toBe(
      false,
    );
  });

  it('avisa cuando una psicóloga toma un caso, para que las demás dejen de verlo', () => {
    expect(esNovedadParaPsicologia({ accion: 'CASO_PSICOLOGIA_TOMADO' })).toBe(
      true,
    );
  });

  it('avisa cuando una psicóloga retoma un caso por reasignar', () => {
    expect(
      esNovedadParaPsicologia({ accion: 'PROCESO_PSICOLOGIA_REASIGNADO' }),
    ).toBe(true);
  });

  it.each([
    'CITA_PSICOLOGICA_PROGRAMADA',
    'PROCESO_PSICOLOGICO_CONSULTADO',
    'LOGIN_SUCCESS',
  ])('ignora %s', (accion) => {
    expect(esNovedadParaPsicologia({ accion })).toBe(false);
  });
});
