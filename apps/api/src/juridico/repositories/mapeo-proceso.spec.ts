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
      fecha: new Date('2026-03-02T00:00:00.000Z'),
      usuaria: { id: 'u-1', nombres: 'Usuaria', apellidos: 'Ficticia' },
    },
    audiencias: [],
    ...parcial,
  } as ProcesoConResumen;
}

describe('mapearResumen', () => {
  /** El mismo proceso ficticio sobre un expediente registrado en `fecha` ("YYYY-MM-DD"). */
  function deExpediente(
    fecha: string,
    parcial: Partial<ProcesoConResumen> = {},
  ): ProcesoConResumen {
    return fila({
      expediente: {
        numero: `05-${fecha.slice(0, 4)}`,
        fecha: new Date(`${fecha}T00:00:00.000Z`),
        usuaria: { id: 'u-1', nombres: 'Usuaria', apellidos: 'Ficticia' },
      },
      ...parcial,
    });
  }

  describe('carpeta del año del expediente', () => {
    it('va en el año del expediente, no en el de inicio del proceso', () => {
      const resumen = mapearResumen(
        deExpediente('2014-07-15', {
          fechaInicio: new Date('2026-03-02T00:00:00.000Z'),
        }),
        AHORA,
      );
      expect(resumen.anioExpediente).toBe(2014);
    });

    it.each([
      ['expediente de este año', '2026-01-01', 'EN_PROCESO', 'ACTIVO', false],
      [
        'expediente de un año anterior y sigue en trámite',
        '2025-12-31',
        'EN_PROCESO',
        'ACTIVO',
        true,
      ],
      [
        'expediente de un año anterior y está suspendido',
        '2014-05-10',
        'EN_PROCESO',
        'SUSPENDIDO',
        true,
      ],
      [
        'expediente de un año anterior pero ya finalizó',
        '2025-06-01',
        'FINALIZADO',
        'ACTIVO',
        false,
      ],
      [
        'expediente de un año anterior pero se abandonó',
        '2025-06-01',
        'EN_PROCESO',
        'ABANDONADO',
        false,
      ],
    ] as const)('%s → %s', (_caso, fecha, fase, situacion, esperado) => {
      const resumen = mapearResumen(
        deExpediente(fecha, { fase, situacion }),
        AHORA,
      );
      expect(resumen.esSeguimiento).toBe(esperado);
    });

    it('el 31/12 a las 21:00 de Guatemala (ya 1/1 en UTC) un expediente de ese año aún no es de seguimiento', () => {
      const resumen = mapearResumen(
        deExpediente('2026-12-01'),
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
