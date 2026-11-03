import {
  contenidoNotificacionAvisos,
  nivelAvisoAudiencia,
  rangoNivelAviso,
  nivelMasUrgente,
  resumenAvisosAudiencias,
} from '@akyuam/shared';

describe('nivelAvisoAudiencia', () => {
  const HOY = '2026-11-03';

  it('clasifica por días de calendario: hoy, mañana, pasado mañana y hasta 7 días', () => {
    expect(nivelAvisoAudiencia('2026-11-03', HOY)).toBe('HOY');
    expect(nivelAvisoAudiencia('2026-11-04', HOY)).toBe('MANANA');
    expect(nivelAvisoAudiencia('2026-11-05', HOY)).toBe('PASADO_MANANA');
    expect(nivelAvisoAudiencia('2026-11-06', HOY)).toBe('PROXIMOS_DIAS');
    expect(nivelAvisoAudiencia('2026-11-10', HOY)).toBe('PROXIMOS_DIAS');
  });

  it('no avisa lo que ya pasó ni lo que está a más de 7 días', () => {
    expect(nivelAvisoAudiencia('2026-11-02', HOY)).toBeNull();
    expect(nivelAvisoAudiencia('2026-11-11', HOY)).toBeNull();
  });

  it('cruza fin de mes y de año sin corrimientos', () => {
    expect(nivelAvisoAudiencia('2027-01-01', '2026-12-31')).toBe('MANANA');
    expect(nivelAvisoAudiencia('2026-12-01', '2026-11-30')).toBe('MANANA');
  });
});

describe('resumenAvisosAudiencias', () => {
  const vacio = { HOY: 0, MANANA: 0, PASADO_MANANA: 0, PROXIMOS_DIAS: 0 };

  it('solo cifras, de lo más urgente a lo menos', () => {
    expect(
      resumenAvisosAudiencias({
        ...vacio,
        HOY: 1,
        MANANA: 2,
        PROXIMOS_DIAS: 3,
      }),
    ).toBe('1 hoy, 2 mañana y 3 en los próximos días');
    expect(resumenAvisosAudiencias({ ...vacio, PASADO_MANANA: 1 })).toBe(
      '1 pasado mañana',
    );
    expect(resumenAvisosAudiencias(vacio)).toBe('');
  });

  it('el nivel más urgente con audiencias', () => {
    expect(nivelMasUrgente({ ...vacio, MANANA: 1, PROXIMOS_DIAS: 4 })).toBe(
      'MANANA',
    );
    expect(nivelMasUrgente(vacio)).toBeNull();
  });
});

describe('rangoNivelAviso', () => {
  it('cada nivel abarca justo los días que clasifica, cruzando fin de mes', () => {
    const hoy = '2026-11-28';
    expect(rangoNivelAviso('HOY', hoy)).toEqual({
      desde: '2026-11-28',
      hasta: '2026-11-28',
    });
    expect(rangoNivelAviso('MANANA', hoy)).toEqual({
      desde: '2026-11-29',
      hasta: '2026-11-29',
    });
    expect(rangoNivelAviso('PASADO_MANANA', hoy)).toEqual({
      desde: '2026-11-30',
      hasta: '2026-11-30',
    });
    expect(rangoNivelAviso('PROXIMOS_DIAS', hoy)).toEqual({
      desde: '2026-12-01',
      hasta: '2026-12-05',
    });
  });
});

describe('contenidoNotificacionAvisos', () => {
  it('el título es lo más urgente y el cuerpo, el resto', () => {
    expect(
      contenidoNotificacionAvisos({
        HOY: 0,
        MANANA: 2,
        PASADO_MANANA: 0,
        PROXIMOS_DIAS: 3,
      }),
    ).toEqual({
      titulo: 'Mañana: 2 audiencias',
      cuerpo: 'Además: 3 en los próximos días. Haz clic para verlas.',
      nivel: 'MANANA',
    });
  });

  it('en singular y sin "Además" cuando no hay más; null si no hay nada', () => {
    expect(
      contenidoNotificacionAvisos({
        HOY: 1,
        MANANA: 0,
        PASADO_MANANA: 0,
        PROXIMOS_DIAS: 0,
      }),
    ).toEqual({
      titulo: 'Hoy: 1 audiencia',
      cuerpo: 'Haz clic para verlas.',
      nivel: 'HOY',
    });
    expect(
      contenidoNotificacionAvisos({
        HOY: 0,
        MANANA: 0,
        PASADO_MANANA: 0,
        PROXIMOS_DIAS: 0,
      }),
    ).toBeNull();
  });
});
