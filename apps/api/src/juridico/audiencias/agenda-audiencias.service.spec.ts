/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import {
  AUDIENCIAS_PAGE_SIZE,
  fechaCalendarioGT,
  finDiaGT,
  sumarDiasGT,
  type AudienciaFilaDto,
} from '@akyuam/shared';
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

  describe('resumen', () => {
    it('cuenta hoy, los próximos 7 días y las pendientes, con la pendiente más antigua', async () => {
      agenda.listar
        .mockResolvedValueOnce({ items: [], total: 2 })
        .mockResolvedValueOnce({ items: [], total: 6 })
        .mockResolvedValueOnce({
          items: [{ fecha: '2026-09-20' } as AudienciaFilaDto],
          total: 10,
        });

      const resumen = await service.resumen({ mias: false }, 'usuario-1');

      const hoy = fechaCalendarioGT(AHORA);
      expect(resumen).toEqual({
        hoy: 2,
        semana: 6,
        pendientes: 10,
        pendienteMasAntigua: '2026-09-20',
      });
      expect(agenda.listar.mock.calls.map(([params]) => params)).toEqual([
        expect.objectContaining({
          vista: 'proximas',
          hasta: finDiaGT(hoy),
          pageSize: 1,
        }),
        expect.objectContaining({
          vista: 'proximas',
          hasta: finDiaGT(sumarDiasGT(hoy, 7)),
          pageSize: 1,
        }),
        expect.objectContaining({ vista: 'pendientes', pageSize: 1 }),
      ]);
    });

    it('sigue el filtro de responsable: "Solo mías" gana sobre la elegida', async () => {
      await service.resumen(
        { mias: true, responsableId: ABOGADA_ID },
        'usuario-1',
      );

      for (const [params] of agenda.listar.mock.calls) {
        expect(params.responsableId).toBeUndefined();
        expect(params.responsableUsuarioId).toBe('usuario-1');
      }
    });

    it('sin pendientes, no hay más antigua', async () => {
      const resumen = await service.resumen({ mias: false }, 'usuario-1');
      expect(resumen.pendienteMasAntigua).toBeNull();
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
