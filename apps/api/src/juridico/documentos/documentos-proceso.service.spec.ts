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
  MENSAJE_DOCUMENTO_CAMBIO,
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
  audiencia: null,
  actuacionId: null,
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
      buscarParaReemplazo: jest.fn().mockResolvedValue({
        claveR2: 'clave-anterior',
        carpetaId: CARPETA_ID,
        audienciaId: null,
        actuacionId: null,
      }),
      reemplazarArchivo: jest.fn().mockResolvedValue(documento),
    };
    bitacora = {
      registrar: jest.fn().mockResolvedValue({ id: 'entrada-1' }),
      actualizarContenido: jest.fn().mockResolvedValue(undefined),
      listarPorProceso: jest.fn(),
      buscarEnProceso: jest.fn(),
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
        'reemplazar el archivo',
        () =>
          service.reemplazarArchivo(
            PROCESO_ID,
            DOCUMENTO_ID,
            archivo(),
            contexto,
          ),
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
      expect(storage.eliminarObjeto).not.toHaveBeenCalled();
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

    it('un documento de audiencia queda enlazado y se audita como tal', async () => {
      const audienciaId = '77777777-7777-4777-8777-777777777777';

      await subir({ audienciaId });

      expect(documentos.crear).toHaveBeenCalledWith(
        expect.objectContaining({ audienciaId }),
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'AUDIENCIA_DOCUMENTO_SUBIDO',
          detalles: {
            procesoId: PROCESO_ID,
            carpetaId: CARPETA_ID,
            audienciaId,
          },
        }),
      );
    });

    it('sin audiencia ni actuación se guarda con ambos en null', async () => {
      await subir();

      expect(documentos.crear).toHaveBeenCalledWith(
        expect.objectContaining({ audienciaId: null, actuacionId: null }),
      );
    });

    it('un documento de actuación queda enlazado, se audita como tal y no anota "Se subió…"', async () => {
      const actuacionId = '77777777-7777-4777-8777-777777777777';

      await subir({ actuacionId });

      expect(documentos.crear).toHaveBeenCalledWith(
        expect.objectContaining({ actuacionId, audienciaId: null }),
      );
      expect(bitacora.registrar).not.toHaveBeenCalled();
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ACTUACION_DOCUMENTO_SUBIDO',
          detalles: {
            procesoId: PROCESO_ID,
            carpetaId: CARPETA_ID,
            actuacionId,
          },
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
          tipo: 'Sistema',
          esSistema: true,
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

  describe('reemplazar archivo', () => {
    // Sin argumento usa un archivo válido; `undefined` explícito simula la petición sin archivo.
    const reemplazar = (...nuevo: [Express.Multer.File | undefined] | []) =>
      service.reemplazarArchivo(
        PROCESO_ID,
        DOCUMENTO_ID,
        nuevo.length ? nuevo[0] : archivo(),
        contexto,
      );

    it('sube el nuevo, cambia la fila y recién entonces borra el anterior', async () => {
      const orden: string[] = [];
      storage.subirObjeto.mockImplementation(() => {
        orden.push('subir');
        return Promise.resolve();
      });
      documentos.reemplazarArchivo.mockImplementation(() => {
        orden.push('base');
        return Promise.resolve(documento);
      });
      storage.eliminarObjeto.mockImplementation((clave) => {
        orden.push(`borrar ${clave}`);
        return Promise.resolve();
      });

      await expect(reemplazar()).resolves.toEqual(documento);

      expect(orden).toEqual(['subir', 'base', 'borrar clave-anterior']);
      const [claveNueva] = storage.subirObjeto.mock.calls[0];
      expect(claveNueva).toMatch(
        new RegExp(
          `^procesos-juridicos/${EXPEDIENTE_ID}/${PROCESO_ID}/[0-9a-f-]{36}$`,
        ),
      );
      expect(documentos.reemplazarArchivo).toHaveBeenCalledWith(
        expect.objectContaining({
          documentoId: DOCUMENTO_ID,
          procesoId: PROCESO_ID,
          claveAnterior: 'clave-anterior',
          claveR2: claveNueva,
          subidoPorId: contexto.usuarioId,
        }),
      );
    });

    it('audita solo ids y deja "Se actualizó 1 documento" en la bitácora', async () => {
      await reemplazar();

      expect(accionesAuditadas(auditService)).toEqual([
        'DOCUMENTO_PROCESO_REEMPLAZADO',
      ]);
      const [evento] = auditService.registrar.mock.calls[0];
      expect(evento.detalles).toEqual({
        procesoId: PROCESO_ID,
        carpetaId: CARPETA_ID,
      });
      expect(JSON.stringify(evento)).not.toContain('archivo de prueba');
      expect(bitacora.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          esSistema: true,
          contenido: 'Se actualizó 1 documento',
        }),
      );
    });

    it('en un documento de actuación no anota nada aparte en la bitácora', async () => {
      documentos.buscarParaReemplazo.mockResolvedValue({
        claveR2: 'clave-anterior',
        carpetaId: CARPETA_ID,
        audienciaId: null,
        actuacionId: 'actuacion-1',
      });

      await reemplazar();

      expect(bitacora.registrar).not.toHaveBeenCalled();
      const [evento] = auditService.registrar.mock.calls[0];
      expect(evento.detalles).toMatchObject({ actuacionId: 'actuacion-1' });
    });

    it('403 si el documento es de otro proceso, sin subir ni borrar nada', async () => {
      documentos.buscarParaReemplazo.mockResolvedValue(null);

      await expect(reemplazar()).rejects.toThrow(
        new ForbiddenException(MENSAJE_SIN_ACCESO_DOCUMENTO),
      );
      expect(documentos.buscarParaReemplazo).toHaveBeenCalledWith(
        DOCUMENTO_ID,
        PROCESO_ID,
      );
      expect(storage.subirObjeto).not.toHaveBeenCalled();
      expect(storage.eliminarObjeto).not.toHaveBeenCalled();
      expect(documentos.reemplazarArchivo).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it.each([
      ['un archivo vacío', archivo({ buffer: Buffer.alloc(0), size: 0 })],
      ['un tipo no permitido', archivo({ mimetype: 'text/html' })],
      ['una petición sin archivo', undefined],
    ])(
      '400 con %s, sin tocar el archivo anterior',
      async (_nombre, invalido) => {
        await expect(reemplazar(invalido)).rejects.toThrow(BadRequestException);
        expect(storage.subirObjeto).not.toHaveBeenCalled();
        expect(storage.eliminarObjeto).not.toHaveBeenCalled();
        expect(documentos.reemplazarArchivo).not.toHaveBeenCalled();
      },
    );

    it('si otra persona lo reemplazó mientras tanto: 409, borra solo el nuevo y conserva el vigente', async () => {
      documentos.reemplazarArchivo.mockResolvedValue(null);

      await expect(reemplazar()).rejects.toThrow(
        new ConflictException(MENSAJE_DOCUMENTO_CAMBIO),
      );
      const [claveNueva] = storage.subirObjeto.mock.calls[0];
      expect(storage.eliminarObjeto.mock.calls).toEqual([[claveNueva]]);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('si falla la base, borra solo el nuevo y el anterior queda intacto', async () => {
      documentos.reemplazarArchivo.mockRejectedValue(
        new Error('fallo de base'),
      );

      await expect(reemplazar()).rejects.toThrow('fallo de base');
      const [claveNueva] = storage.subirObjeto.mock.calls[0];
      expect(storage.eliminarObjeto.mock.calls).toEqual([[claveNueva]]);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('si falla la subida del nuevo, no toca la base ni el anterior', async () => {
      storage.subirObjeto.mockRejectedValue(new Error('fallo de R2'));

      await expect(reemplazar()).rejects.toThrow('fallo de R2');
      expect(documentos.reemplazarArchivo).not.toHaveBeenCalled();
      expect(storage.eliminarObjeto).not.toHaveBeenCalled();
    });

    it('si borrar el anterior falla, reintenta y el reemplazo igual queda hecho y auditado', async () => {
      storage.eliminarObjeto.mockRejectedValue(new Error('fallo de R2'));

      await expect(reemplazar()).resolves.toEqual(documento);
      expect(storage.eliminarObjeto).toHaveBeenCalledTimes(2);
      expect(storage.eliminarObjeto).toHaveBeenCalledWith('clave-anterior');
      expect(accionesAuditadas(auditService)).toEqual([
        'DOCUMENTO_PROCESO_REEMPLAZADO',
      ]);
    });
  });
});
