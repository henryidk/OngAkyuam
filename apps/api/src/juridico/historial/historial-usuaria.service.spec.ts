/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
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
      buscar: jest.fn().mockResolvedValue([]),
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
        telefono: null,
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
    await service.buscar('texto-buscado', contexto);

    expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
      'texto-buscado',
    );
  });
});
