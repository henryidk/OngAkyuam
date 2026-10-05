/* eslint-disable @typescript-eslint/unbound-method */
import {
  FILAS_COLA_INICIO,
  FILAS_MIS_PROCESOS_INICIO,
  type ReferenciaBandejaDto,
} from '@akyuam/shared';
import type { IInicioRepository } from '../interfaces/inicio-repository.interface';
import type { IReferenciasRepository } from '../interfaces/referencias-repository.interface';
import { EXPEDIENTE_ID, REFERIDO_ID, USUARIA_ID } from '../pruebas/dobles';
import { InicioJuridicoService } from './inicio-juridico.service';

const CUENTA_ID = '77777777-7777-4777-8777-777777777777';

function referencia(indice: number): ReferenciaBandejaDto {
  return {
    referidoId: REFERIDO_ID,
    expedienteId: EXPEDIENTE_ID,
    expedienteNumero: `0${indice}-2026`,
    usuaria: {
      id: USUARIA_ID,
      nombreCompleto: 'Usuaria de prueba',
      dpi: '0000000000000',
    },
    motivo: 'Motivo de prueba',
    referidoEn: '2026-10-01T15:00:00.000Z',
    referidoPor: 'Trabajadora social',
    procesosSugeridos: ['PENSION_ALIMENTICIA'],
    devueltoEn: null,
    motivoDevolucion: null,
    edad: 30,
    municipio: null,
    regresa: false,
  } as ReferenciaBandejaDto;
}

describe('InicioJuridicoService', () => {
  let inicioRepository: jest.Mocked<IInicioRepository>;
  let referenciasRepository: jest.Mocked<IReferenciasRepository>;
  let service: InicioJuridicoService;

  beforeEach(() => {
    inicioRepository = {
      colaProcesos: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      resumenAnio: jest
        .fn()
        .mockResolvedValue({ total: 0, enTramite: 0, finalizados: 0 }),
      tieneFichaPersonal: jest.fn().mockResolvedValue(true),
      novedadesTs: jest.fn().mockResolvedValue([]),
    };
    referenciasRepository = {
      listar: jest.fn().mockResolvedValue([]),
      buscarPendientePorExpediente: jest.fn(),
      devolver: jest.fn(),
    };
    service = new InicioJuridicoService(
      inicioRepository,
      referenciasRepository,
    );
  });

  it('"Mis procesos" se pide con la cuenta que consulta', async () => {
    await service.obtener(CUENTA_ID);

    expect(inicioRepository.tieneFichaPersonal).toHaveBeenCalledWith(CUENTA_ID);
    expect(inicioRepository.colaProcesos).toHaveBeenCalledWith(
      { cola: 'MIOS', usuarioId: CUENTA_ID },
      FILAS_MIS_PROCESOS_INICIO,
    );
  });

  it('sin ficha de personal, "Mis procesos" es null y no se consulta', async () => {
    inicioRepository.tieneFichaPersonal.mockResolvedValue(false);

    const inicio = await service.obtener(CUENTA_ID);

    expect(inicio.misProcesos).toBeNull();
    expect(inicioRepository.colaProcesos).not.toHaveBeenCalledWith(
      expect.objectContaining({ cola: 'MIOS' }),
      expect.anything(),
    );
  });

  it('las referencias nuevas solo llevan los datos de la tarjeta: ni DPI ni motivo', async () => {
    referenciasRepository.listar.mockResolvedValue([referencia(1)]);

    const inicio = await service.obtener(CUENTA_ID);

    expect(referenciasRepository.listar).toHaveBeenCalledWith('pendientes');
    expect(inicio.referenciasNuevas.items).toEqual([
      {
        referidoId: REFERIDO_ID,
        expedienteId: EXPEDIENTE_ID,
        expedienteNumero: '01-2026',
        usuaria: { id: USUARIA_ID, nombreCompleto: 'Usuaria de prueba' },
        referidoEn: '2026-10-01T15:00:00.000Z',
        procesosSugeridos: ['PENSION_ALIMENTICIA'],
      },
    ]);
  });

  it('corta las referencias a las filas de la cola, pero el total cuenta todas', async () => {
    const pendientes = Array.from({ length: FILAS_COLA_INICIO + 2 }, (_, i) =>
      referencia(i),
    );
    referenciasRepository.listar.mockResolvedValue(pendientes);

    const inicio = await service.obtener(CUENTA_ID);

    expect(inicio.referenciasNuevas.items).toHaveLength(FILAS_COLA_INICIO);
    expect(inicio.referenciasNuevas.total).toBe(FILAS_COLA_INICIO + 2);
  });
});
