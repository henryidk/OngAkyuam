import { AHORA } from '../pruebas/dobles';
import { mapearResumen, type ProcesoConResumen } from './mapeo-proceso';

// Fila ficticia tal como la devuelve Prisma con `INCLUDE_RESUMEN`.
function fila(parcial: Partial<ProcesoConResumen> = {}): ProcesoConResumen {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    expedienteId: '11111111-1111-4111-8111-111111111111',
    consecutivo: 1,
    tipo: 'MEDIDAS_SEGURIDAD',
    fase: 'EN_PROCESO',
    situacion: 'ACTIVO',
    formaFinalizacion: null,
    detalleFinalizacion: null,
    numeroJudicial: null,
    fechaInicio: new Date('2026-03-02T00:00:00.000Z'),
    fechaCierre: null,
    ultimaActuacionEn: AHORA,
    abogada: null,
    procuradora: null,
    expediente: {
      numero: '05-2026',
      usuaria: { id: 'u-1', nombres: 'Usuaria', apellidos: 'Ficticia' },
    },
    audiencias: [],
    ...parcial,
  } as ProcesoConResumen;
}

describe('mapearResumen', () => {
  describe('esSeguimiento', () => {
    it.each([
      ['empezó este año', '2026-01-01', 'EN_PROCESO', 'ACTIVO', false],
      [
        'empezó antes y sigue en trámite',
        '2025-12-31',
        'EN_PROCESO',
        'ACTIVO',
        true,
      ],
      [
        'empezó antes y está suspendido',
        '2024-05-10',
        'EN_PROCESO',
        'SUSPENDIDO',
        true,
      ],
      [
        'empezó antes pero ya finalizó',
        '2025-06-01',
        'FINALIZADO',
        'ACTIVO',
        false,
      ],
      [
        'empezó antes pero se abandonó',
        '2025-06-01',
        'EN_PROCESO',
        'ABANDONADO',
        false,
      ],
    ] as const)('%s → %s', (_caso, inicio, fase, situacion, esperado) => {
      const resumen = mapearResumen(
        fila({
          fechaInicio: new Date(`${inicio}T00:00:00.000Z`),
          fase,
          situacion,
        }),
        AHORA,
      );
      expect(resumen.esSeguimiento).toBe(esperado);
    });

    it('el 31/12 a las 21:00 de Guatemala (ya 1/1 en UTC) un proceso de ese año aún no es de seguimiento', () => {
      const resumen = mapearResumen(
        fila({ fechaInicio: new Date('2026-12-01T00:00:00.000Z') }),
        new Date('2027-01-01T03:00:00.000Z'),
      );
      expect(resumen.esSeguimiento).toBe(false);
    });
  });

  describe('proximaAudiencia', () => {
    it('null si no tiene ninguna programada', () => {
      expect(mapearResumen(fila(), AHORA).proximaAudiencia).toBeNull();
    });

    it.each([
      // AHORA = 19/10/2026 09:00 en Guatemala.
      ['2026-10-19T14:00:00.000Z', '19/10/2026 08:00', 'PENDIENTE_RESULTADO'],
      ['2026-10-19T22:00:00.000Z', '19/10/2026 16:00', 'HOY'],
      ['2026-10-21T15:30:00.000Z', '21/10/2026 09:30', 'PROXIMA'],
    ] as const)('%s (%s) → %s', (inicio, _legible, estadoVisible) => {
      const resumen = mapearResumen(
        fila({ audiencias: [{ id: 'a-1', inicio: new Date(inicio) }] }),
        AHORA,
      );
      expect(resumen.proximaAudiencia).toMatchObject({
        id: 'a-1',
        inicio,
        estadoVisible,
      });
    });

    it('fecha y hora en Guatemala, no en UTC', () => {
      // 20/10/2026 02:00 UTC = 19/10/2026 20:00 en Guatemala.
      const resumen = mapearResumen(
        fila({
          audiencias: [
            { id: 'a-1', inicio: new Date('2026-10-20T02:00:00.000Z') },
          ],
        }),
        AHORA,
      );
      expect(resumen.proximaAudiencia).toMatchObject({
        fecha: '2026-10-19',
        hora: '20:00',
        estadoVisible: 'HOY',
      });
    });
  });
});
