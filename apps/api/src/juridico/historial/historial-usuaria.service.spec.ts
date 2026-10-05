/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MENSAJE_SIN_ACCESO_USUARIA } from '../compartido/mensajes';
import type { IUsuariasJuridicoRepository } from '../interfaces/usuarias-repository.interface';
import {
  USUARIA_ID,
  contexto,
  crearAuditService,
  crearProcesosRepository,
} from '../pruebas/dobles';
import { HistorialUsuariaService } from './historial-usuaria.service';

describe('HistorialUsuariaService', () => {
  let usuarias: jest.Mocked<IUsuariasJuridicoRepository>;
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: HistorialUsuariaService;

  beforeEach(() => {
    usuarias = {
      listar: jest.fn().mockResolvedValue({
        filas: [],
        pagina: 1,
        porPagina: 20,
        total: 0,
        contadores: {
          TODAS: 0,
          REFERENCIA_NUEVA: 0,
          CON_ACTIVOS: 0,
          SIN_ACTIVOS: 0,
        },
      }),
      obtenerFicha: jest.fn().mockResolvedValue(null),
    };
    procesosRepository = crearProcesosRepository();
    auditService = crearAuditService();
    service = new HistorialUsuariaService(
      usuarias,
      procesosRepository,
      auditService,
    );
  });

  it('403 uniforme si la usuaria no existe o nunca fue referida a Jurídico', async () => {
    await expect(service.obtener(USUARIA_ID, contexto)).rejects.toThrow(
      new ForbiddenException(MENSAJE_SIN_ACCESO_USUARIA),
    );
    expect(procesosRepository.listarPorUsuaria).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('audita la consulta del historial', async () => {
    usuarias.obtenerFicha.mockResolvedValue({
      usuaria: {
        id: USUARIA_ID,
        nombreCompleto: 'Nombre Ficticio',
        dpi: null,
        edad: 30,
        grupoEtnico: 'LADINO',
        municipio: null,
      },
      expediente: {
        id: 'expediente-1',
        numero: '01-2026',
        tipoRegistro: 'EXTERNA',
        enAlbergue: false,
      },
      referencias: [],
    });

    await service.obtener(USUARIA_ID, contexto);

    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'HISTORIAL_USUARIA_JURIDICO_CONSULTADO',
        entidadId: USUARIA_ID,
      }),
    );
  });

  it('audita que se buscó, nunca el texto buscado', async () => {
    await service.listar({ q: 'texto-buscado', pagina: 1 }, contexto);

    expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
      'texto-buscado',
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'USUARIAS_JURIDICO_LISTADAS',
        detalles: expect.objectContaining({ conBusqueda: true }) as unknown,
      }),
    );
  });

  it('interpreta la búsqueda igual que Trabajo Social (expediente con ceros, filtro y página)', async () => {
    await service.listar(
      { q: '5-2026', filtro: 'CON_ACTIVOS', pagina: 2 },
      contexto,
    );

    expect(usuarias.listar).toHaveBeenCalledWith({
      filtro: 'CON_ACTIVOS',
      busqueda: { tipo: 'numeroExpediente', valor: '05-2026' },
      pagina: 2,
      porPagina: 20,
    });
  });

  it('400 si el nombre tiene menos de 3 letras, sin consultar', async () => {
    await expect(
      service.listar({ q: 'ab', pagina: 1 }, contexto),
    ).rejects.toThrow(BadRequestException);
    expect(usuarias.listar).not.toHaveBeenCalled();
  });

  it('la ficha cuenta suspendidos como en proceso y abandonados como cerrados', async () => {
    usuarias.obtenerFicha.mockResolvedValue({
      usuaria: {
        id: USUARIA_ID,
        nombreCompleto: 'Nombre Ficticio',
        dpi: null,
        edad: 30,
        grupoEtnico: 'LADINO',
        municipio: null,
      },
      expediente: {
        id: 'expediente-1',
        numero: '01-2026',
        tipoRegistro: 'EXTERNA',
        enAlbergue: false,
      },
      referencias: [],
    });
    procesosRepository.listarPorUsuaria.mockResolvedValue([
      { fase: 'EN_PROCESO', situacion: 'SUSPENDIDO' },
      { fase: 'EN_PROCESO', situacion: 'ACTIVO' },
      { fase: 'EN_PROCESO', situacion: 'ABANDONADO' },
      { fase: 'FINALIZADO', situacion: 'ACTIVO' },
    ] as never);

    const ficha = await service.obtener(USUARIA_ID, contexto);

    expect(ficha.contadores).toEqual({ enProceso: 2, cerrados: 2 });
  });
});
