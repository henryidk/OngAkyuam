import {
  estadoVisible,
  limiteInactividad,
  requiereAtencion,
} from './estado-visible';
import { codigoProceso } from './codigo-proceso';

const AHORA = new Date('2026-09-30T12:00:00.000Z');
const HACE_61_DIAS = new Date('2026-07-31T12:00:00.000Z');
const HACE_59_DIAS = new Date('2026-08-02T12:00:00.000Z');

describe('estadoVisible', () => {
  it.each([
    ['INICIADO', 'ACTIVO', 'EN_TRAMITE'],
    ['EN_PROCESO', 'ACTIVO', 'EN_TRAMITE'],
    ['EN_PROCESO', 'SUSPENDIDO', 'SUSPENDIDO'],
    ['INICIADO', 'ABANDONADO', 'ABANDONADO'],
    ['FINALIZADO', 'ACTIVO', 'FINALIZADO'],
  ] as const)('%s + %s -> %s', (fase, situacion, esperado) => {
    expect(estadoVisible({ fase, situacion })).toBe(esperado);
  });
});

describe('requiereAtencion', () => {
  it('avisa cuando un proceso en trámite supera los 60 días sin actuación', () => {
    expect(
      requiereAtencion(
        { fase: 'EN_PROCESO', situacion: 'ACTIVO' },
        HACE_61_DIAS,
        AHORA,
      ),
    ).toBe(true);
  });

  it('no avisa dentro del plazo', () => {
    expect(
      requiereAtencion(
        { fase: 'EN_PROCESO', situacion: 'ACTIVO' },
        HACE_59_DIAS,
        AHORA,
      ),
    ).toBe(false);
  });

  it.each([
    ['FINALIZADO', 'ACTIVO'],
    ['EN_PROCESO', 'SUSPENDIDO'],
    ['EN_PROCESO', 'ABANDONADO'],
  ] as const)('nunca avisa en %s/%s', (fase, situacion) => {
    expect(requiereAtencion({ fase, situacion }, HACE_61_DIAS, AHORA)).toBe(
      false,
    );
  });

  it('el límite es exactamente 60 días atrás', () => {
    expect(limiteInactividad(AHORA).toISOString()).toBe(
      '2026-08-01T12:00:00.000Z',
    );
  });
});

describe('codigoProceso', () => {
  it('une el consecutivo con el número de expediente', () => {
    expect(codigoProceso(2, '05-2026')).toBe('J2-05-2026');
  });
});
