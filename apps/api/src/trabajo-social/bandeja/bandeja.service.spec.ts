/* eslint-disable @typescript-eslint/unbound-method */
import type { IndicadoresTs } from '@akyuam/shared';
import { BandejaService, FILAS_POR_COLA } from './bandeja.service';
import type { IBandejaRepository } from './interfaces/bandeja-repository.interface';

describe('BandejaService', () => {
  let service: BandejaService;
  let repositorio: jest.Mocked<IBandejaRepository>;

  const caso = {
    expedienteId: 'e-1',
    usuariaId: 'u-1',
    numero: '05-2026',
    nombres: 'Maria',
    apellidos: 'Perez',
  };

  const indicadores: IndicadoresTs = {
    enAtencion: 7,
    sinAtencionActiva: 2,
    ninosEnAlbergue: 3,
    activosPorArea: [
      { area: 'JURIDICO', total: 4 },
      { area: 'PSICOLOGIA', total: 3 },
      { area: 'MEDICA', total: 1 },
    ],
  };

  beforeEach(() => {
    repositorio = {
      indicadores: jest.fn().mockResolvedValue(indicadores),
      pendientesReferir: jest.fn().mockResolvedValue({ filas: [], total: 0 }),
      enAlbergue: jest.fn().mockResolvedValue({ filas: [], total: 0 }),
    };
    service = new BandejaService(repositorio);
  });

  it('limita cada cola y entrega los indicadores tal cual', async () => {
    const bandeja = await service.obtener();

    expect(repositorio.pendientesReferir).toHaveBeenCalledWith(FILAS_POR_COLA);
    expect(repositorio.enAlbergue).toHaveBeenCalledWith(FILAS_POR_COLA);
    expect(bandeja.indicadores).toEqual(indicadores);
  });

  it('conserva el total real de la cola aunque solo lleguen 5 filas', async () => {
    repositorio.pendientesReferir.mockResolvedValue({
      filas: [
        {
          ...caso,
          tipoRegistro: 'EXTERNA',
          casoCreadoEn: new Date('2026-09-01T15:00:00.000Z'),
        },
      ],
      total: 12,
    });

    const bandeja = await service.obtener();

    expect(bandeja.pendientesReferir).toEqual({
      total: 12,
      filas: [
        {
          expedienteId: 'e-1',
          usuariaId: 'u-1',
          numeroExpediente: '05-2026',
          nombreCompleto: 'Maria Perez',
          tipoRegistro: 'EXTERNA',
          createdAt: '2026-09-01T15:00:00.000Z',
        },
      ],
    });
  });

  it('calcula los días en albergue y tolera un ingreso sin fecha', async () => {
    repositorio.enAlbergue.mockResolvedValue({
      filas: [
        {
          ...caso,
          fechaIngresoAlbergue: new Date('2000-01-01T00:00:00.000Z'),
          cantidadNinos: 2,
        },
        {
          ...caso,
          expedienteId: 'e-2',
          fechaIngresoAlbergue: null,
          cantidadNinos: 0,
        },
      ],
      total: 2,
    });

    const { enAlbergue } = await service.obtener();

    expect(enAlbergue.filas[0]).toMatchObject({
      fechaIngresoAlbergue: '2000-01-01',
      cantidadNinos: 2,
    });
    expect(enAlbergue.filas[0].diasEnAlbergue).toBeGreaterThan(9000);
    expect(enAlbergue.filas[1]).toMatchObject({
      fechaIngresoAlbergue: null,
      diasEnAlbergue: null,
    });
  });
});
