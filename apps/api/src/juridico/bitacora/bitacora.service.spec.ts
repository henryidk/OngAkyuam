/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import {
  BITACORA_POR_PAGINA,
  CARPETA_ACTUACIONES,
  bitacoraQuerySchema,
  registrarActuacionSchema,
} from '@akyuam/shared';
import {
  MENSAJE_SIN_ACCESO_ACTUACION,
  MENSAJE_SIN_ACCESO_PROCESO,
} from '../compartido/mensajes';
import type { DocumentosProcesoService } from '../documentos/documentos-proceso.service';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import type { ICarpetasRepository } from '../interfaces/documentos-proceso-repository.interface';
import {
  CARPETA_ID,
  PROCESO_ID,
  contexto,
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
} from '../pruebas/dobles';
import { BitacoraService } from './bitacora.service';

// RedisService importa @nestjs/config (ESM puro), que Jest no carga: aquí solo se usa su tipo.
jest.mock('../../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

const ENTRADA_ID = '77777777-7777-4777-8777-777777777777';

describe('BitacoraService', () => {
  let bitacora: jest.Mocked<IBitacoraRepository>;
  let carpetas: jest.Mocked<Pick<ICarpetasRepository, 'obtenerOCrear'>>;
  let documentosService: { subir: jest.Mock };
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
          documentos: [],
        }),
      ),
      actualizarContenido: jest.fn(),
      listarPagina: jest
        .fn()
        .mockResolvedValue({ entradas: [], pagina: 1, total: 0 }),
      contarActuaciones: jest.fn().mockResolvedValue(0),
      buscarEnProceso: jest.fn().mockResolvedValue({ esSistema: false }),
    };
    carpetas = { obtenerOCrear: jest.fn().mockResolvedValue(CARPETA_ID) };
    documentosService = { subir: jest.fn().mockResolvedValue({ id: 'doc-1' }) };
    procesosRepository = crearProcesosRepository();
    service = new BitacoraService(
      bitacora,
      carpetas as unknown as ICarpetasRepository,
      documentosService as unknown as DocumentosProcesoService,
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

  describe('ver una página', () => {
    const query = { pagina: 3 };

    it('pide esa página del proceso y deja constancia en la auditoría', async () => {
      const audit = crearAuditService();
      service = new BitacoraService(
        bitacora,
        carpetas as unknown as ICarpetasRepository,
        documentosService as unknown as DocumentosProcesoService,
        crearAcceso(procesosRepository),
        audit,
      );
      await service.listarPagina(PROCESO_ID, query, contexto);

      expect(bitacora.listarPagina).toHaveBeenCalledWith(PROCESO_ID, {
        pagina: 3,
        porPagina: BITACORA_POR_PAGINA,
      });
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'BITACORA_PROCESO_CONSULTADA',
          entidadId: PROCESO_ID,
          detalles: expect.objectContaining({ pagina: 3 }) as unknown,
        }),
      );
    });

    it('403 sin acceso al proceso, sin leer la bitácora', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);
      await expect(
        service.listarPagina(PROCESO_ID, query, contexto),
      ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO));
      expect(bitacora.listarPagina).not.toHaveBeenCalled();
    });

    it('rechaza páginas que no son enteros positivos', () => {
      expect(bitacoraQuerySchema.safeParse({ pagina: '0' }).success).toBe(
        false,
      );
      expect(bitacoraQuerySchema.safeParse({ pagina: '-2' }).success).toBe(
        false,
      );
      expect(bitacoraQuerySchema.safeParse({ pagina: '1.5' }).success).toBe(
        false,
      );
      expect(bitacoraQuerySchema.parse({})).toEqual({ pagina: 1 });
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

  describe('documentos de una actuación', () => {
    const params = { archivo: undefined, nombreVisible: 'Escrito ficticio' };
    const subir = () =>
      service.subirDocumento(PROCESO_ID, ENTRADA_ID, params, contexto);

    it('se guarda en la carpeta Actuaciones, enlazado a la actuación', async () => {
      await subir();

      expect(bitacora.buscarEnProceso).toHaveBeenCalledWith(
        ENTRADA_ID,
        PROCESO_ID,
      );
      expect(carpetas.obtenerOCrear).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        nombre: CARPETA_ACTUACIONES,
        creadaPorId: contexto.usuarioId,
      });
      expect(documentosService.subir).toHaveBeenCalledWith(
        {
          ...params,
          procesoId: PROCESO_ID,
          carpetaId: CARPETA_ID,
          actuacionId: ENTRADA_ID,
        },
        contexto,
      );
    });

    it('403 sin acceso al proceso, sin buscar la actuación', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

      await expect(subir()).rejects.toThrow(
        new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO),
      );
      expect(bitacora.buscarEnProceso).not.toHaveBeenCalled();
      expect(documentosService.subir).not.toHaveBeenCalled();
    });

    it.each([
      ['no existe o es de otro proceso', null],
      ['es una entrada de sistema', { esSistema: true }],
    ])('403 si la actuación %s, sin subir nada', async (_caso, entrada) => {
      bitacora.buscarEnProceso.mockResolvedValue(entrada);

      await expect(subir()).rejects.toThrow(
        new ForbiddenException(MENSAJE_SIN_ACCESO_ACTUACION),
      );
      expect(carpetas.obtenerOCrear).not.toHaveBeenCalled();
      expect(documentosService.subir).not.toHaveBeenCalled();
    });
  });
});
