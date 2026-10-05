/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { registrarActuacionSchema } from '@akyuam/shared';
import { MENSAJE_SIN_ACCESO_PROCESO } from '../compartido/mensajes';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import {
  PROCESO_ID,
  contexto,
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
} from '../pruebas/dobles';
import { BitacoraService } from './bitacora.service';
import { combinarSugerencias } from './sugerencias-tipo-actuacion';

describe('BitacoraService', () => {
  let bitacora: jest.Mocked<IBitacoraRepository>;
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let service: BitacoraService;

  beforeEach(() => {
    bitacora = {
      registrar: jest.fn((params) =>
        Promise.resolve({
          id: 'entrada-1',
          tipo: params.tipo,
          esSistema: params.esSistema,
          contenido: params.contenido,
          registradoPor: 'Persona Ficticia',
          createdAt: '2026-10-05T12:00:00.000Z',
        }),
      ),
      actualizarContenido: jest.fn(),
      listarPorProceso: jest.fn(),
      tiposUsadosEnProceso: jest.fn().mockResolvedValue([]),
      tiposMasUsadosPorTipoProceso: jest.fn().mockResolvedValue([]),
    };
    procesosRepository = crearProcesosRepository();
    service = new BitacoraService(
      bitacora,
      crearAcceso(procesosRepository),
      crearAuditService(),
    );
  });

  describe('registrar actuación', () => {
    it('lo que escribe la operadora nunca es entrada de sistema, aunque el tipo diga "Sistema"', async () => {
      const datos = registrarActuacionSchema.parse({
        tipo: 'Sistema',
        contenido: 'Texto ficticio',
      });
      await service.registrarActuacion(PROCESO_ID, datos, contexto);

      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'Sistema', esSistema: false }),
      );
    });

    it('403 sin acceso al proceso', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);
      await expect(
        service.registrarActuacion(
          PROCESO_ID,
          { tipo: 'Escrito', contenido: 'Texto ficticio' },
          contexto,
        ),
      ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO));
      expect(bitacora.registrar).not.toHaveBeenCalled();
    });
  });

  describe('schema del tipo de actuación', () => {
    it('normaliza espacios', () => {
      const datos = registrarActuacionSchema.parse({
        tipo: '  Memorial   de evacuación ',
        contenido: 'x',
      });
      expect(datos.tipo).toBe('Memorial de evacuación');
    });

    it.each([
      ['vacío', '   '],
      ['de más de 60 caracteres', 'a'.repeat(61)],
    ])('rechaza un tipo %s', (_caso, tipo) => {
      expect(
        registrarActuacionSchema.safeParse({ tipo, contenido: 'x' }).success,
      ).toBe(false);
    });
  });

  describe('sugerencias de tipo', () => {
    it('primero las del proceso, luego las de su tipo, sin duplicados por mayúsculas', async () => {
      bitacora.tiposUsadosEnProceso.mockResolvedValue([
        'Memorial de evacuación',
        'Audiencia',
      ]);
      bitacora.tiposMasUsadosPorTipoProceso.mockResolvedValue([
        'audiencia',
        'Escrito',
      ]);

      await expect(service.sugerirTipos(PROCESO_ID)).resolves.toEqual([
        'Memorial de evacuación',
        'Audiencia',
        'Escrito',
      ]);
      expect(bitacora.tiposMasUsadosPorTipoProceso).toHaveBeenCalledWith(
        'MEDIDAS_SEGURIDAD',
        10,
      );
    });

    it('como máximo 10', () => {
      const muchos = Array.from({ length: 15 }, (_, i) => `Tipo ${i}`);
      expect(combinarSugerencias(muchos, ['Otro'])).toHaveLength(10);
    });

    it('403 sin acceso al proceso', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);
      await expect(service.sugerirTipos(PROCESO_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(bitacora.tiposUsadosEnProceso).not.toHaveBeenCalled();
    });
  });
});
