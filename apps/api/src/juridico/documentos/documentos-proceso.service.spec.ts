/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { DocumentoProcesoDto } from '@akyuam/shared';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import {
  MENSAJE_CARPETA_DUPLICADA,
  MENSAJE_SIN_ACCESO_CARPETA,
  MENSAJE_SIN_ACCESO_DOCUMENTO,
  MENSAJE_SIN_ACCESO_PROCESO,
} from '../compartido/mensajes';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';
import type {
  ICarpetasRepository,
  IDocumentosProcesoRepository,
} from '../interfaces/documentos-proceso-repository.interface';
import {
  CARPETA_ID,
  DOCUMENTO_ID,
  EXPEDIENTE_ID,
  PROCESO_ID,
  accionesAuditadas,
  contexto,
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
  crearRedis,
} from '../pruebas/dobles';
import { DocumentosProcesoService } from './documentos-proceso.service';

// RedisService importa @nestjs/config (ESM puro), que Jest no carga: aquí solo se usa su tipo.
jest.mock('../../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

function archivo(
  parcial: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  const buffer = Buffer.from('%PDF-1.7 contenido de prueba');
  return {
    originalname: 'archivo de prueba.pdf',
    mimetype: 'application/pdf',
    buffer,
    size: buffer.length,
    ...parcial,
  } as Express.Multer.File;
}

const documento: DocumentoProcesoDto = {
  id: DOCUMENTO_ID,
  carpetaId: CARPETA_ID,
  nombreVisible: 'archivo de prueba',
  nombreArchivo: 'archivo de prueba.pdf',
  mimeType: 'application/pdf',
  tamanioBytes: 28,
  subidoPor: 'Persona Ficticia',
  createdAt: '2026-01-15T12:00:00.000Z',
};

describe('DocumentosProcesoService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let carpetas: jest.Mocked<ICarpetasRepository>;
  let documentos: jest.Mocked<IDocumentosProcesoRepository>;
  let bitacora: jest.Mocked<IBitacoraRepository>;
  let storage: jest.Mocked<IObjectStorage>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: DocumentosProcesoService;

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    carpetas = {
      listarConDocumentos: jest.fn(),
      crear: jest.fn().mockResolvedValue({
        id: CARPETA_ID,
        nombre: 'Pruebas',
        documentos: [],
      }),
      renombrar: jest.fn().mockResolvedValue('RENOMBRADA'),
      perteneceAlProceso: jest.fn().mockResolvedValue(true),
    };
    documentos = {
      crear: jest.fn().mockResolvedValue(documento),
      renombrar: jest.fn().mockResolvedValue(documento),
      buscarParaUrl: jest.fn().mockResolvedValue({
        claveR2: 'clave-interna',
        nombreVisible: 'archivo de prueba',
        mimeType: 'application/pdf',
        carpetaId: CARPETA_ID,
      }),
    };
    bitacora = {
      registrar: jest.fn().mockResolvedValue({ id: 'entrada-1' }),
      actualizarContenido: jest.fn().mockResolvedValue(undefined),
      listarPorProceso: jest.fn(),
    };
    storage = {
      subirObjeto: jest.fn().mockResolvedValue(undefined),
      eliminarObjeto: jest.fn().mockResolvedValue(undefined),
      generarUrlDescarga: jest.fn().mockResolvedValue('https://descarga'),
      generarUrlVistaPrevia: jest.fn().mockResolvedValue('https://vista'),
    };
    auditService = crearAuditService();
    service = new DocumentosProcesoService(
      carpetas,
      documentos,
      bitacora,
      storage,
      crearAcceso(procesosRepository),
      crearRedis(),
      auditService,
    );
  });

  const subir = (parcial = {}) =>
    service.subir(
      {
        procesoId: PROCESO_ID,
        carpetaId: CARPETA_ID,
        archivo: archivo(),
        ...parcial,
      },
      contexto,
    );

  describe('autorización', () => {
    beforeEach(() => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);
    });

    it.each([
      ['subir', () => subir()],
      ['crear carpeta', () => service.crearCarpeta(PROCESO_ID, 'X', contexto)],
      [
        'renombrar carpeta',
        () => service.renombrarCarpeta(PROCESO_ID, CARPETA_ID, 'X', contexto),
      ],
      [
        'renombrar documento',
        () =>
          service.renombrarDocumento(PROCESO_ID, DOCUMENTO_ID, 'X', contexto),
      ],
      [
        'pedir la URL',
        () =>
          service.generarUrl(PROCESO_ID, DOCUMENTO_ID, 'descarga', contexto),
      ],
    ])('403 uniforme al %s sin acceso al proceso', async (_nombre, accion) => {
      await expect(accion()).rejects.toThrow(
        new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO),
      );
      expect(storage.subirObjeto).not.toHaveBeenCalled();
      expect(storage.generarUrlDescarga).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('subir', () => {
    it('guarda con una clave hecha solo de ids y audita sin el nombre del archivo', async () => {
      await subir();

      const [clave, , mimeType] = storage.subirObjeto.mock.calls[0];
      expect(clave).toMatch(
        new RegExp(
          `^procesos-juridicos/${EXPEDIENTE_ID}/${PROCESO_ID}/[0-9a-f-]{36}$`,
        ),
      );
      expect(mimeType).toBe('application/pdf');
      expect(documentos.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          carpetaId: CARPETA_ID,
          nombreVisible: 'archivo de prueba',
          claveR2: clave,
          subidoPorId: contexto.usuarioId,
        }),
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DOCUMENTO_PROCESO_SUBIDO',
          entidadId: DOCUMENTO_ID,
          detalles: { procesoId: PROCESO_ID, carpetaId: CARPETA_ID },
        }),
      );
    });

    it('403 si la carpeta es de otro proceso, sin subir nada', async () => {
      carpetas.perteneceAlProceso.mockResolvedValue(false);

      await expect(subir()).rejects.toThrow(
        new ForbiddenException(MENSAJE_SIN_ACCESO_CARPETA),
      );
      expect(carpetas.perteneceAlProceso).toHaveBeenCalledWith(
        CARPETA_ID,
        PROCESO_ID,
      );
      expect(storage.subirObjeto).not.toHaveBeenCalled();
    });

    it.each([
      ['un tipo no permitido', archivo({ mimetype: 'text/html' })],
      [
        'un contenido que no coincide con su tipo',
        archivo({ buffer: Buffer.from('<html></html>') }),
      ],
      ['un archivo vacío', archivo({ buffer: Buffer.alloc(0), size: 0 })],
      ['una petición sin archivo', undefined],
    ])('400 con %s, sin subir nada', async (_nombre, invalido) => {
      await expect(subir({ archivo: invalido })).rejects.toThrow(
        BadRequestException,
      );
      expect(storage.subirObjeto).not.toHaveBeenCalled();
      expect(documentos.crear).not.toHaveBeenCalled();
    });

    it('si falla el registro en la base, borra el archivo ya subido', async () => {
      documentos.crear.mockRejectedValue(new Error('fallo de base'));

      await expect(subir()).rejects.toThrow('fallo de base');

      const [clave] = storage.subirObjeto.mock.calls[0];
      expect(storage.eliminarObjeto).toHaveBeenCalledWith(clave);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('una tanda de varios archivos deja una sola entrada de bitácora', async () => {
      const tanda = 'tanda-de-prueba-01';
      await Promise.all([subir({ tanda }), subir({ tanda }), subir({ tanda })]);

      expect(bitacora.registrar).toHaveBeenCalledTimes(1);
      expect(bitacora.actualizarContenido).toHaveBeenLastCalledWith(
        'entrada-1',
        'Se subieron 3 documentos',
      );
    });

    it('sin tanda, cada archivo deja su entrada', async () => {
      await subir();
      await subir();

      expect(bitacora.registrar).toHaveBeenCalledTimes(2);
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'SISTEMA',
          contenido: 'Se subió 1 documento',
        }),
      );
    });
  });

  describe('carpetas', () => {
    it('409 si ya existe una carpeta con ese nombre', async () => {
      carpetas.crear.mockResolvedValue(null);

      await expect(
        service.crearCarpeta(PROCESO_ID, 'Pruebas', contexto),
      ).rejects.toThrow(new ConflictException(MENSAJE_CARPETA_DUPLICADA));
    });

    it('409 al renombrar hacia un nombre que ya existe', async () => {
      carpetas.renombrar.mockResolvedValue('NOMBRE_DUPLICADO');

      await expect(
        service.renombrarCarpeta(PROCESO_ID, CARPETA_ID, 'Pruebas', contexto),
      ).rejects.toThrow(new ConflictException(MENSAJE_CARPETA_DUPLICADA));
    });

    it('403 al renombrar una carpeta de otro proceso', async () => {
      carpetas.renombrar.mockResolvedValue('INEXISTENTE');

      await expect(
        service.renombrarCarpeta(PROCESO_ID, CARPETA_ID, 'Pruebas', contexto),
      ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_CARPETA));
    });
  });

  describe('URL firmada', () => {
    it('403 si el documento es de otro proceso', async () => {
      documentos.buscarParaUrl.mockResolvedValue(null);

      await expect(
        service.generarUrl(PROCESO_ID, DOCUMENTO_ID, 'vista', contexto),
      ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO));
      expect(documentos.buscarParaUrl).toHaveBeenCalledWith(
        DOCUMENTO_ID,
        PROCESO_ID,
      );
      expect(storage.generarUrlVistaPrevia).not.toHaveBeenCalled();
    });

    it('vista previa para un tipo permitido, auditada como vista', async () => {
      const { url } = await service.generarUrl(
        PROCESO_ID,
        DOCUMENTO_ID,
        'vista',
        contexto,
      );

      expect(url).toBe('https://vista');
      expect(accionesAuditadas(auditService)).toEqual([
        'DOCUMENTO_PROCESO_VISTO',
      ]);
    });

    it('un tipo fuera de la lista blanca nunca se muestra en línea', async () => {
      documentos.buscarParaUrl.mockResolvedValue({
        claveR2: 'clave-interna',
        nombreVisible: 'archivo',
        mimeType: 'text/html',
        carpetaId: CARPETA_ID,
      });

      const { url } = await service.generarUrl(
        PROCESO_ID,
        DOCUMENTO_ID,
        'vista',
        contexto,
      );

      expect(url).toBe('https://descarga');
      expect(storage.generarUrlVistaPrevia).not.toHaveBeenCalled();
      expect(accionesAuditadas(auditService)).toEqual([
        'DOCUMENTO_PROCESO_DESCARGADO',
      ]);
    });
  });
});
