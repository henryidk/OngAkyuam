import { esNovedadParaJuridico } from './avisos-juridico.listener';

describe('esNovedadParaJuridico', () => {
  it('avisa de una referencia a Jurídico', () => {
    expect(
      esNovedadParaJuridico({
        accion: 'EXPEDIENTE_REFERIDO',
        detalles: { area: 'JURIDICO' },
      }),
    ).toBe(true);
  });

  it('no avisa de una referencia a otra área', () => {
    expect(
      esNovedadParaJuridico({
        accion: 'EXPEDIENTE_REFERIDO',
        detalles: { area: 'PSICOLOGICA' },
      }),
    ).toBe(false);
    expect(esNovedadParaJuridico({ accion: 'EXPEDIENTE_REFERIDO' })).toBe(
      false,
    );
  });

  it.each([
    'USUARIA_ACTUALIZADA',
    'USUARIA_DPI_MODIFICADO',
    'DOCUMENTO_SUBIDO',
    'DOCUMENTO_VERSION_SUBIDA',
  ])('avisa de %s', (accion) => {
    expect(esNovedadParaJuridico({ accion })).toBe(true);
  });

  it.each(['DOCUMENTO_DESCARGADO', 'LOGIN_SUCCESS', 'PROCESO_CREADO'])(
    'ignora %s',
    (accion) => {
      expect(esNovedadParaJuridico({ accion })).toBe(false);
    },
  );
});
