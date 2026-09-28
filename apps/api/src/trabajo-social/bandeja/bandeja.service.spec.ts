/* eslint-disable @typescript-eslint/unbound-method */
import {
  BandejaService,
  FILAS_POR_COLA,
  LIMITE_NOVEDADES,
} from './bandeja.service';
import type {
  IBandejaRepository,
  NovedadRow,
} from './interfaces/bandeja-repository.interface';

describe('BandejaService', () => {
  let service: BandejaService;
  let repositorio: jest.Mocked<IBandejaRepository>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  const caso = {
    expedienteId: 'e-1',
    usuariaId: 'u-1',
    numero: '05-2026',
    nombres: 'Maria',
    apellidos: 'Perez',
  };

  function novedad(overrides: Partial<NovedadRow> = {}): NovedadRow {
    return {
      id: 'a-1',
      accion: 'PROCESO_JURIDICO_CREADO',
      detalles: { expedienteId: 'e-1', tipo: 'JUICIO_EJECUTIVO' },
      createdAt: new Date('2026-09-01T15:00:00.000Z'),
      expedienteId: 'e-1',
      usuariaId: 'u-1',
      nombres: 'Maria',
      apellidos: 'Perez',
      ...overrides,
    };
  }

  beforeEach(() => {
    repositorio = {
      pendientesReferir: jest.fn().mockResolvedValue({ filas: [], total: 0 }),
      documentosPendientes: jest
        .fn()
        .mockResolvedValue({ filas: [], total: 0 }),
      enAlbergue: jest.fn().mockResolvedValue({ filas: [], total: 0 }),
      recientes: jest.fn().mockResolvedValue([]),
      novedades: jest.fn().mockResolvedValue([]),
      resumenMes: jest.fn().mockResolvedValue({
        usuariasRegistradas: 3,
        ninosRegistrados: 2,
        referencias: 4,
      }),
    };
    service = new BandejaService(repositorio);
  });

  it('limita cada cola y pide novedades del usuario autenticado', async () => {
    await service.obtener(contexto);

    expect(repositorio.pendientesReferir).toHaveBeenCalledWith(FILAS_POR_COLA);
    expect(repositorio.documentosPendientes).toHaveBeenCalledWith(
      FILAS_POR_COLA,
    );
    expect(repositorio.enAlbergue).toHaveBeenCalledWith(FILAS_POR_COLA);
    const [usuarioId, acciones, limite] = repositorio.novedades.mock.calls[0];
    expect(usuarioId).toBe('ts-1');
    expect(limite).toBe(LIMITE_NOVEDADES);
    // Solo acciones de las áreas: lo que hizo Trabajo Social no es "novedad de un área".
    expect(acciones).toContain('ATENCION_PSICOLOGICA_TOMADA');
    expect(acciones).not.toContain('EXPEDIENTE_REFERIDO');
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

    const bandeja = await service.obtener(contexto);

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

    const { enAlbergue } = await service.obtener(contexto);

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

  it('traduce las novedades y descarta acciones que no son de un área', async () => {
    repositorio.novedades.mockResolvedValue([
      novedad(),
      novedad({ id: 'a-2', accion: 'EXPEDIENTE_REFERIDO' }),
      novedad({ id: 'a-3', accion: 'EXPEDIENTE_CONSULTADO' }),
    ]);

    const { novedades } = await service.obtener(contexto);

    expect(novedades).toEqual([
      {
        id: 'a-1',
        area: 'JURIDICO',
        expedienteId: 'e-1',
        usuariaId: 'u-1',
        nombreCompleto: 'Maria Perez',
        texto: 'Jurídico abrió un proceso (Juicio Ejecutivo)',
        createdAt: '2026-09-01T15:00:00.000Z',
      },
    ]);
  });

  it('pide el resumen del mes calendario de Guatemala', async () => {
    const { resumenMes } = await service.obtener(contexto);

    const [params] = repositorio.resumenMes.mock.calls[0];
    expect(params.mes).toBeGreaterThanOrEqual(1);
    expect(params.mes).toBeLessThanOrEqual(12);
    expect(params.inicio.getTime()).toBeLessThan(params.fin.getTime());
    expect(resumenMes).toEqual({
      usuariasRegistradas: 3,
      ninosRegistrados: 2,
      referencias: 4,
    });
  });
});
