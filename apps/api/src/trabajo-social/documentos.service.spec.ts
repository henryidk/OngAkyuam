// Los mocks de Jest (jest.fn()) nunca dependen de "this", pero @typescript-eslint/unbound-method
// no lo sabe y marca como error cada `expect(mock.metodo)...` porque el tipo de origen
// (interfaz o clase real) declara el método sin `this: void` — falso positivo conocido de la
// regla al combinarse con jest.Mocked<T>, sin equivalente en este repo a eslint-plugin-jest.
/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import type { IDocumentosRepository } from './interfaces/documentos-repository.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import type { AuditService } from '../auth/services/audit.service';

function crearArchivo(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'archivo',
    originalname: 'documento.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('contenido'),
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

describe('DocumentosService', () => {
  let service: DocumentosService;
  let documentosRepository: jest.Mocked<IDocumentosRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'usuario-1',
    username: 'trabajadora',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    documentosRepository = {
      buscarExpedienteParaSubida: jest.fn(),
      crear: jest.fn(),
      buscarParaDescarga: jest.fn(),
    };
    objectStorage = {
      subirObjeto: jest.fn().mockResolvedValue(undefined),
      eliminarObjeto: jest.fn().mockResolvedValue(undefined),
      generarUrlDescarga: jest
        .fn()
        .mockResolvedValue('https://descarga.firmada/x'),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new DocumentosService(
      documentosRepository,
      objectStorage,
      auditService,
    );

    documentosRepository.buscarExpedienteParaSubida.mockResolvedValue({
      tipoRegistro: 'EXTERNA',
      areasReferidas: ['JURIDICO'],
    });
  });

  it('rechaza la subida si no se adjunta archivo', async () => {
    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'ENTREVISTA_USUARIA',
          areasVisiblesRaw: '[]',
          archivo: undefined as unknown as Express.Multer.File,
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
  });

  it('rechaza un tipo de documento inválido', async () => {
    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'NO_EXISTE',
          areasVisiblesRaw: '[]',
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un MIME type fuera de la lista blanca', async () => {
    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'ENTREVISTA_USUARIA',
          areasVisiblesRaw: '[]',
          archivo: crearArchivo({ mimetype: 'application/x-msdownload' }),
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
  });

  it('rechaza si el expediente no existe', async () => {
    documentosRepository.buscarExpedienteParaSubida.mockResolvedValue(null);

    await expect(
      service.subir(
        {
          expedienteId: 'exp-inexistente',
          tipo: 'ENTREVISTA_USUARIA',
          areasVisiblesRaw: '[]',
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rechaza documentos de albergue en un expediente EXTERNA', async () => {
    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'CONVENIO_INGRESO',
          areasVisiblesRaw: '[]',
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
  });

  it('permite documentos de albergue en un expediente INTERNA', async () => {
    documentosRepository.buscarExpedienteParaSubida.mockResolvedValue({
      tipoRegistro: 'INTERNA',
      areasReferidas: [],
    });
    documentosRepository.crear.mockResolvedValue({
      id: 'doc-1',
      tipo: 'CONVENIO_INGRESO',
      nombreArchivo: 'documento.pdf',
      tamanioBytes: 1024,
      createdAt: new Date(),
    });

    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'CONVENIO_INGRESO',
          areasVisiblesRaw: '[]',
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).resolves.toBeDefined();
  });

  it('rechaza areasVisibles que no fueron referidas al expediente', async () => {
    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'ENTREVISTA_USUARIA',
          areasVisiblesRaw: JSON.stringify(['MEDICA']),
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
  });

  it('rechaza un areasVisibles que no es JSON válido', async () => {
    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'ENTREVISTA_USUARIA',
          areasVisiblesRaw: '{no-es-json',
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('camino feliz: sube a R2, crea el documento, audita y no devuelve la clave R2', async () => {
    documentosRepository.crear.mockResolvedValue({
      id: 'doc-1',
      tipo: 'ENTREVISTA_USUARIA',
      nombreArchivo: 'documento.pdf',
      tamanioBytes: 1024,
      createdAt: new Date('2026-09-15T12:00:00Z'),
    });

    const resultado = await service.subir(
      {
        expedienteId: 'exp-1',
        tipo: 'ENTREVISTA_USUARIA',
        areasVisiblesRaw: JSON.stringify(['JURIDICO']),
        archivo: crearArchivo(),
      },
      contexto,
    );

    expect(objectStorage.subirObjeto).toHaveBeenCalledWith(
      expect.stringMatching(/^expedientes\/exp-1\//),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(documentosRepository.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        expedienteId: 'exp-1',
        tipo: 'ENTREVISTA_USUARIA',
        areasVisibles: ['JURIDICO'],
        subidoPorId: contexto.usuarioId,
      }),
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'DOCUMENTO_SUBIDO',
        entidad: 'Documento',
        entidadId: 'doc-1',
        detalles: { expedienteId: 'exp-1', tipo: 'ENTREVISTA_USUARIA' },
      }),
    );
    expect(resultado).not.toHaveProperty('claveR2');
    expect(resultado).toEqual({
      id: 'doc-1',
      tipo: 'ENTREVISTA_USUARIA',
      nombreArchivo: 'documento.pdf',
      tamanioBytes: 1024,
      createdAt: '2026-09-15T12:00:00.000Z',
    });
  });

  it('si falla la escritura en base de datos, limpia el objeto ya subido a R2', async () => {
    documentosRepository.crear.mockRejectedValue(
      new Error('fallo de base de datos'),
    );

    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'ENTREVISTA_USUARIA',
          areasVisiblesRaw: '[]',
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).rejects.toThrow('fallo de base de datos');

    expect(objectStorage.eliminarObjeto).toHaveBeenCalledWith(
      expect.stringMatching(/^expedientes\/exp-1\//),
    );
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  describe('obtenerUrlDescarga', () => {
    it('lanza 404 si el documento no existe en ese expediente', async () => {
      documentosRepository.buscarParaDescarga.mockResolvedValue(null);

      await expect(
        service.obtenerUrlDescarga('exp-1', 'doc-x', contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(objectStorage.generarUrlDescarga).not.toHaveBeenCalled();
    });

    it('genera la URL firmada y audita la descarga', async () => {
      documentosRepository.buscarParaDescarga.mockResolvedValue({
        claveR2: 'expedientes/exp-1/archivo',
        nombreArchivo: 'documento.pdf',
      });

      const resultado = await service.obtenerUrlDescarga(
        'exp-1',
        'doc-1',
        contexto,
      );

      expect(objectStorage.generarUrlDescarga).toHaveBeenCalledWith(
        'expedientes/exp-1/archivo',
        'documento.pdf',
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DOCUMENTO_DESCARGADO',
          entidad: 'Documento',
          entidadId: 'doc-1',
          detalles: { expedienteId: 'exp-1' },
        }),
      );
      expect(resultado).toEqual({ url: 'https://descarga.firmada/x' });
    });
  });
});
