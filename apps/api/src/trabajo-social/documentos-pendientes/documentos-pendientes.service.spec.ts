// Ver documentos.service.spec.ts: falso positivo de unbound-method con jest.Mocked<T>.
/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AuditService } from '../../auth/services/audit.service';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import { DocumentosPendientesService } from './documentos-pendientes.service';
import type { IDocumentosPendientesRepository } from './interfaces/documentos-pendientes-repository.interface';

function crearArchivo(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'archivo',
    originalname: 'entrevista-ficticia.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 2048,
    buffer: Buffer.from('contenido'),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

describe('DocumentosPendientesService', () => {
  let service: DocumentosPendientesService;
  let repository: jest.Mocked<IDocumentosPendientesRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    repository = {
      crear: jest.fn(),
      eliminarDeUsuario: jest.fn(),
      listarVencidos: jest.fn(),
      eliminar: jest.fn(),
    };
    objectStorage = {
      subirObjeto: jest.fn().mockResolvedValue(undefined),
      eliminarObjeto: jest.fn().mockResolvedValue(undefined),
      generarUrlDescarga: jest.fn(),
      generarUrlVistaPrevia: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    service = new DocumentosPendientesService(
      repository,
      objectStorage,
      auditService,
    );
    repository.crear.mockImplementation((params) =>
      Promise.resolve({
        id: 'pend-1',
        tipo: params.tipo,
        nombreArchivo: params.nombreArchivo,
        tamanioBytes: params.tamanioBytes,
      }),
    );
  });

  describe('subir', () => {
    it('sube a R2 con una clave generada (nunca el nombre del archivo) y registra quién lo subió', async () => {
      const subido = await service.subir(
        { tipo: 'ENTREVISTA_USUARIA', archivo: crearArchivo() },
        contexto,
      );

      const clave = objectStorage.subirObjeto.mock.calls[0][0];
      expect(clave).toMatch(/^registro\/[0-9a-f-]{36}$/);
      expect(clave).not.toContain('entrevista');
      expect(repository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          claveR2: clave,
          subidoPorId: 'ts-1',
          tipo: 'ENTREVISTA_USUARIA',
        }),
      );
      expect(subido).toEqual({
        id: 'pend-1',
        tipo: 'ENTREVISTA_USUARIA',
        nombreArchivo: 'entrevista-ficticia.pdf',
        tamanioBytes: 2048,
      });
    });

    it('audita solo el tipo, nunca el nombre del archivo', async () => {
      await service.subir(
        { tipo: 'ENTREVISTA_USUARIA', archivo: crearArchivo() },
        contexto,
      );

      const registro = auditService.registrar.mock.calls[0][0];
      expect(registro).toMatchObject({
        accion: 'DOCUMENTO_PENDIENTE_SUBIDO',
        entidadId: 'pend-1',
        detalles: { tipo: 'ENTREVISTA_USUARIA' },
      });
      expect(JSON.stringify(registro)).not.toContain('entrevista-ficticia');
    });

    it.each([
      ['sin archivo', { tipo: 'ENTREVISTA_USUARIA', archivo: undefined }],
      [
        'MIME fuera de la lista blanca',
        {
          tipo: 'ENTREVISTA_USUARIA',
          archivo: crearArchivo({ mimetype: 'text/html' }),
        },
      ],
      ['tipo inválido', { tipo: 'NO_EXISTE', archivo: crearArchivo() }],
      ['sin tipo', { tipo: undefined, archivo: crearArchivo() }],
    ])('rechaza con 400 (%s) sin tocar R2', async (_caso, params) => {
      await expect(service.subir(params, contexto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('si R2 falla, propaga el 503 y no crea la fila', async () => {
      objectStorage.subirObjeto.mockRejectedValue(
        new ServiceUnavailableException(),
      );

      await expect(
        service.subir(
          { tipo: 'ENTREVISTA_USUARIA', archivo: crearArchivo() },
          contexto,
        ),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.crear).not.toHaveBeenCalled();
    });

    it('si la base falla, borra el objeto huérfano y propaga el error original', async () => {
      const errorBase = new Error('fallo de base');
      repository.crear.mockRejectedValue(errorBase);
      objectStorage.eliminarObjeto.mockRejectedValue(new Error('R2 caído'));

      await expect(
        service.subir(
          { tipo: 'ENTREVISTA_USUARIA', archivo: crearArchivo() },
          contexto,
        ),
      ).rejects.toBe(errorBase);
      expect(objectStorage.eliminarObjeto).toHaveBeenCalledWith(
        objectStorage.subirObjeto.mock.calls[0][0],
      );
    });
  });

  describe('descartar', () => {
    it('solo borra lo que subió la misma persona, y luego el objeto en R2', async () => {
      repository.eliminarDeUsuario.mockResolvedValue('registro/clave');

      await service.descartar('pend-1', contexto);

      expect(repository.eliminarDeUsuario).toHaveBeenCalledWith(
        'pend-1',
        'ts-1',
      );
      expect(objectStorage.eliminarObjeto).toHaveBeenCalledWith(
        'registro/clave',
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DOCUMENTO_PENDIENTE_DESCARTADO',
          entidadId: 'pend-1',
        }),
      );
    });

    it('404 si no existe o es de otra persona, sin tocar R2', async () => {
      repository.eliminarDeUsuario.mockResolvedValue(null);

      await expect(
        service.descartar('pend-otra', contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(objectStorage.eliminarObjeto).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('si R2 falla al borrar, igual responde bien (la fila ya no existe)', async () => {
      repository.eliminarDeUsuario.mockResolvedValue('registro/clave');
      objectStorage.eliminarObjeto.mockRejectedValue(new Error('R2 caído'));

      await expect(
        service.descartar('pend-1', contexto),
      ).resolves.toBeUndefined();
    });
  });
});
