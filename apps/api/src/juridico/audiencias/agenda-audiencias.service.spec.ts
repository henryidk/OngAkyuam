/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { AUDIENCIAS_PAGE_SIZE } from '@akyuam/shared';
import type { IAgendaAudienciasRepository } from '../interfaces/agenda-audiencias-repository.interface';
import {
  ABOGADA_ID,
  AHORA,
  PROCESO_ID,
  accionesAuditadas,
  contexto,
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
  relojFijo,
} from '../pruebas/dobles';
import { AgendaAudienciasService } from './agenda-audiencias.service';

describe('AgendaAudienciasService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let agenda: jest.Mocked<IAgendaAudienciasRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: AgendaAudienciasService;

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    agenda = {
      listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      listarOcupadas: jest.fn().mockResolvedValue([]),
      listarPorProceso: jest.fn().mockResolvedValue([]),
    };
    auditService = crearAuditService();
    service = new AgendaAudienciasService(
      agenda,
      crearAcceso(procesosRepository),
      relojFijo(),
      auditService,
    );
  });

  describe('listar', () => {
    it('convierte el rango a días completos de Guatemala y pagina', async () => {
      const respuesta = await service.listar(
        {
          vista: 'historial',
          desde: '2026-10-01',
          hasta: '2026-10-31',
          page: 2,
        },
        'usuario-1',
      );

      expect(agenda.listar).toHaveBeenCalledWith({
        vista: 'historial',
        q: undefined,
        responsableId: undefined,
        responsableUsuarioId: undefined,
        desde: new Date('2026-10-01T06:00:00.000Z'),
        hasta: new Date('2026-11-01T05:59:59.999Z'),
        estado: undefined,
        page: 2,
        pageSize: AUDIENCIAS_PAGE_SIZE,
        ahora: AHORA,
      });
      expect(respuesta).toEqual({
        items: [],
        total: 0,
        page: 2,
        pageSize: AUDIENCIAS_PAGE_SIZE,
      });
    });

    it('"Mías" filtra por la cuenta que consulta, nunca por un id del cliente', async () => {
      await service.listar(
        { vista: 'proximas', mias: true, page: 1 },
        'usuario-1',
      );

      expect(agenda.listar).toHaveBeenCalledWith(
        expect.objectContaining({ responsableUsuarioId: 'usuario-1' }),
      );
    });
  });

  it('disponibilidad: las ocupadas de ese día en Guatemala', async () => {
    const respuesta = await service.disponibilidad({
      responsableId: ABOGADA_ID,
      fecha: '2026-10-22',
    });

    expect(agenda.listarOcupadas).toHaveBeenCalledWith(
      ABOGADA_ID,
      new Date('2026-10-22T06:00:00.000Z'),
      new Date('2026-10-23T05:59:59.999Z'),
    );
    expect(respuesta).toEqual({
      fecha: '2026-10-22',
      responsableId: ABOGADA_ID,
      audiencias: [],
    });
  });

  describe('listarPorProceso', () => {
    it('403 uniforme si el proceso no es de Jurídico, sin leer ni auditar', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

      await expect(
        service.listarPorProceso(PROCESO_ID, contexto),
      ).rejects.toThrow(ForbiddenException);
      expect(agenda.listarPorProceso).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('lee con el reloj de la petición y audita la consulta', async () => {
      await service.listarPorProceso(PROCESO_ID, contexto);

      expect(agenda.listarPorProceso).toHaveBeenCalledWith(PROCESO_ID, AHORA);
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'AUDIENCIAS_CONSULTADAS',
          entidad: 'ProcesoJuridico',
          entidadId: PROCESO_ID,
        }),
      );
      expect(accionesAuditadas(auditService)).toHaveLength(1);
    });
  });
});
