import { codigoAtencion } from './codigo-atencion';
import { admiteInasistencia, derivarEstadoCita } from './estado-cita';
import {
  puedeReprogramar,
  referenciaPendiente,
  situacionPaciente,
} from './reglas-atencion';

const INICIO = new Date('2026-10-12T14:00:00.000Z');
const minutos = (n: number) => new Date(INICIO.getTime() + n * 60_000);
const programada = {
  estado: 'PROGRAMADA' as const,
  inicio: INICIO,
  duracionMin: 30,
};

describe('derivarEstadoCita', () => {
  it('PROGRAMADA antes de empezar', () => {
    expect(derivarEstadoCita(programada, minutos(-1))).toBe('PROGRAMADA');
  });

  it('EN_CURSO dentro de [inicio, fin)', () => {
    expect(derivarEstadoCita(programada, minutos(0))).toBe('EN_CURSO');
    expect(derivarEstadoCita(programada, minutos(29))).toBe('EN_CURSO');
  });

  it('SIN_REGISTRAR desde que termina', () => {
    expect(derivarEstadoCita(programada, minutos(30))).toBe('SIN_REGISTRAR');
  });

  it('los demás estados se muestran tal cual', () => {
    expect(
      derivarEstadoCita({ ...programada, estado: 'ATENDIDA' }, minutos(60)),
    ).toBe('ATENDIDA');
    expect(
      derivarEstadoCita({ ...programada, estado: 'NO_ASISTIO' }, minutos(-60)),
    ).toBe('NO_ASISTIO');
  });

  it('la inasistencia solo se admite cuando la cita ya empezó', () => {
    expect(admiteInasistencia(programada, minutos(-1))).toBe(false);
    expect(admiteInasistencia(programada, minutos(5))).toBe(true);
    expect(admiteInasistencia(programada, minutos(120))).toBe(true);
    expect(
      admiteInasistencia({ ...programada, estado: 'ATENDIDA' }, minutos(5)),
    ).toBe(false);
  });
});

describe('referenciaPendiente', () => {
  const referidoEn = new Date('2026-10-01T00:00:00.000Z');

  it('pendiente sin atenciones', () => {
    expect(referenciaPendiente(referidoEn, [])).toBe(true);
  });

  it('pendiente si solo hay atenciones cerradas anteriores (re-referencia)', () => {
    expect(
      referenciaPendiente(referidoEn, [
        { estado: 'ALTA', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      ]),
    ).toBe(true);
  });

  it('no pendiente con una atención activa o abierta después de referir', () => {
    expect(
      referenciaPendiente(referidoEn, [
        { estado: 'ACTIVA', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      ]),
    ).toBe(false);
    expect(
      referenciaPendiente(referidoEn, [
        { estado: 'ALTA', createdAt: new Date('2026-10-02T00:00:00.000Z') },
      ]),
    ).toBe(false);
  });
});

describe('situacionPaciente y reprogramación', () => {
  it('la atención activa manda sobre la referencia pendiente', () => {
    expect(situacionPaciente(true, true)).toBe('EN_ATENCION');
    expect(situacionPaciente(false, true)).toBe('POR_AGENDAR');
    expect(situacionPaciente(false, false)).toBe('DE_ALTA');
  });

  it('solo se reprograma una inasistencia sin reprogramar, activa y sin cita futura', () => {
    const base = {
      estado: 'NO_ASISTIO',
      reprogramadaA: null,
      atencionActiva: true,
      tieneCitaFutura: false,
    };
    expect(puedeReprogramar(base)).toBe(true);
    expect(puedeReprogramar({ ...base, reprogramadaA: { id: 'x' } })).toBe(
      false,
    );
    expect(puedeReprogramar({ ...base, atencionActiva: false })).toBe(false);
    expect(puedeReprogramar({ ...base, tieneCitaFutura: true })).toBe(false);
    expect(puedeReprogramar({ ...base, estado: 'ATENDIDA' })).toBe(false);
  });

  it('codigoAtencion', () => {
    expect(codigoAtencion(2, '2026-0014')).toBe('M2-2026-0014');
  });
});
