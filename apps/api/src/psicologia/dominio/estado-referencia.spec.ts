import { estadoReferencia, type AtencionTomada } from './estado-referencia';

const REFERIDO = 'referido-1';

function tomada(parcial: Partial<AtencionTomada> = {}): AtencionTomada {
  return {
    referidoId: REFERIDO,
    psicologaAsignadaId: 'psicologa-a',
    fechaInicio: null,
    estado: 'INICIO',
    ...parcial,
  };
}

describe('estadoReferencia', () => {
  it('sin tomar mientras nadie se haya hecho cargo', () => {
    expect(estadoReferencia(REFERIDO, [], 'psicologa-a')).toBe('SIN_TOMAR');
  });

  it('por agendar para quien tomó el caso y aún no le pone primera cita', () => {
    expect(estadoReferencia(REFERIDO, [tomada()], 'psicologa-a')).toBe(
      'POR_AGENDAR',
    );
  });

  it('a la psicóloga anterior no le pide agendar el caso que tomó una colega', () => {
    const anteriorCerrado = tomada({
      referidoId: 'referido-anterior',
      psicologaAsignadaId: 'psicologa-a',
      fechaInicio: new Date('2026-01-10T15:00:00.000Z'),
      estado: 'CIERRE',
    });
    const nuevoDeColega = tomada({ psicologaAsignadaId: 'psicologa-b' });

    expect(
      estadoReferencia(
        REFERIDO,
        [anteriorCerrado, nuevoDeColega],
        'psicologa-a',
      ),
    ).toBe('ATENDIDA');
    // La colega que lo tomó sí lo tiene pendiente.
    expect(
      estadoReferencia(
        REFERIDO,
        [anteriorCerrado, nuevoDeColega],
        'psicologa-b',
      ),
    ).toBe('POR_AGENDAR');
  });

  it.each([
    [
      'ya tiene primera cita',
      { fechaInicio: new Date('2026-09-01T15:00:00.000Z') },
    ],
    ['se cerró sin llegar a agendar', { estado: 'CIERRE' as const }],
    ['el caso pendiente es de otra referencia', { referidoId: 'otra' }],
  ])('atendida cuando %s', (_caso, parcial) => {
    expect(estadoReferencia(REFERIDO, [tomada(parcial)], 'psicologa-a')).toBe(
      'ATENDIDA',
    );
  });
});
