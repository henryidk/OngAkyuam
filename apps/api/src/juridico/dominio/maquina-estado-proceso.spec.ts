import {
  ACCIONES_PROCESO,
  FASES_PROCESO_JURIDICO,
  SITUACIONES_PROCESO_JURIDICO,
  type AccionProceso,
} from '@akyuam/shared';
import {
  accionesDisponibles,
  puedeAplicar,
  type EstadoProceso,
} from './maquina-estado-proceso';

/** Tabla de verdad completa: cada combinación fase × situación con sus acciones permitidas. */
const ESPERADO: Record<string, AccionProceso[]> = {
  'INICIADO/ACTIVO': ['FINALIZAR', 'SUSPENDER', 'ABANDONAR'],
  'INICIADO/SUSPENDIDO': ['ABANDONAR', 'REACTIVAR'],
  'INICIADO/ABANDONADO': ['REACTIVAR'],
  'EN_PROCESO/ACTIVO': ['FINALIZAR', 'SUSPENDER', 'ABANDONAR'],
  'EN_PROCESO/SUSPENDIDO': ['ABANDONAR', 'REACTIVAR'],
  'EN_PROCESO/ABANDONADO': ['REACTIVAR'],
  'FINALIZADO/ACTIVO': [],
  // Combinaciones que la base de datos prohíbe (CHECK finalizado_activo): si aun así
  // aparecieran, lo único que se ofrece es devolverlas a un estado válido.
  'FINALIZADO/SUSPENDIDO': ['REACTIVAR'],
  'FINALIZADO/ABANDONADO': ['REACTIVAR'],
};

describe('máquina de estados del proceso jurídico', () => {
  for (const fase of FASES_PROCESO_JURIDICO) {
    for (const situacion of SITUACIONES_PROCESO_JURIDICO) {
      const estado: EstadoProceso = { fase, situacion };
      const clave = `${fase}/${situacion}`;

      it(`${clave} permite exactamente: ${ESPERADO[clave].join(', ') || 'nada'}`, () => {
        expect(accionesDisponibles(estado)).toEqual(ESPERADO[clave]);
        for (const accion of ACCIONES_PROCESO) {
          expect(puedeAplicar(accion, estado)).toBe(
            ESPERADO[clave].includes(accion),
          );
        }
      });
    }
  }

  it('un proceso finalizado no admite ninguna transición', () => {
    expect(
      accionesDisponibles({ fase: 'FINALIZADO', situacion: 'ACTIVO' }),
    ).toEqual([]);
  });

  it('no se puede finalizar un proceso suspendido o abandonado sin reactivarlo antes', () => {
    expect(
      puedeAplicar('FINALIZAR', {
        fase: 'EN_PROCESO',
        situacion: 'SUSPENDIDO',
      }),
    ).toBe(false);
    expect(
      puedeAplicar('FINALIZAR', {
        fase: 'EN_PROCESO',
        situacion: 'ABANDONADO',
      }),
    ).toBe(false);
  });
});
