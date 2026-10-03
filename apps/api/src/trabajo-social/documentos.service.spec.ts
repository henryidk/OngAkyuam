// Los mocks de Jest (jest.fn()) nunca dependen de "this", pero @typescript-eslint/unbound-method
// no lo sabe y marca como error cada `expect(mock.metodo)...` porque el tipo de origen
// (interfaz o clase real) declara el método sin `this: void` — falso positivo conocido de la
// regla al combinarse con jest.Mocked<T>, sin equivalente en este repo a eslint-plugin-jest.
/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  construirFilasDocumentos,
  DocumentosService,
} from './documentos.service';
import {
  DocumentoYaReemplazadoError,
  type DocumentoVigente,
  type ExpedienteParaDocumento,
  type IDocumentosRepository,
} from './interfaces/documentos-repository.interface';
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

const expedienteExterna: ExpedienteParaDocumento = {
  numero: '01-2026',
  tipoRegistro: 'EXTERNA',
  tieneEgresoAlbergue: false,
  areasReferidas: ['JURIDICO'],
};

function crearVigente(
  overrides: Partial<DocumentoVigente> = {},
): DocumentoVigente {
  return {
    id: 'doc-1',
    tipo: 'ENTREVISTA_USUARIA',
    version: 1,
    vigente: true,
    nombreArchivo: 'documento.pdf',
    mimeType: 'application/pdf',
    tamanioBytes: 1024,
    createdAt: '2026-09-15T12:00:00.000Z',
    subidoPor: 'Trabajadora Social Prueba',
    areasVisibles: [],
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
      buscarExpediente: jest.fn(),
      existeVigente: jest.fn().mockResolvedValue(false),
      crear: jest.fn(),
      buscarParaVersionar: jest.fn(),
      crearVersion: jest.fn(),
      listarVigentes: jest.fn(),
      listarVersiones: jest.fn(),
      buscarParaDescarga: jest.fn(),
    };
    objectStorage = {
      subirObjeto: jest.fn().mockResolvedValue(undefined),
      eliminarObjeto: jest.fn().mockResolvedValue(undefined),
      generarUrlDescarga: jest
        .fn()
        .mockResolvedValue('https://descarga.firmada/x'),
      generarUrlVistaPrevia: jest
        .fn()
        .mockResolvedValue('https://vista.firmada/x'),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new DocumentosService(
      documentosRepository,
      objectStorage,
      auditService,
    );

    documentosRepository.buscarExpediente.mockResolvedValue(expedienteExterna);
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
    documentosRepository.buscarExpediente.mockResolvedValue(null);

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
    documentosRepository.buscarExpediente.mockResolvedValue({
      ...expedienteExterna,
      tipoRegistro: 'INTERNA',
      areasReferidas: [],
    });
    documentosRepository.crear.mockResolvedValue({
      id: 'doc-1',
      tipo: 'CONVENIO_INGRESO',
      version: 1,
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
      version: 1,
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

  it('propaga el 503 y no registra nada si el almacenamiento no está disponible', async () => {
    objectStorage.subirObjeto.mockRejectedValue(
      new ServiceUnavailableException(),
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
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(documentosRepository.crear).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('rechaza con 409 si el caso ya tiene ese documento vigente', async () => {
    documentosRepository.existeVigente.mockResolvedValue(true);

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
    ).rejects.toBeInstanceOf(ConflictException);
    expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
  });

  it('rechaza el convenio de egreso en un expediente EXTERNA', async () => {
    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'CONVENIO_EGRESO',
          areasVisiblesRaw: '[]',
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza subir directamente el formato de atención psicológica', async () => {
    await expect(
      service.subir(
        {
          expedienteId: 'exp-1',
          tipo: 'FORMATO_ATENCION_PSICOLOGICA',
          areasVisiblesRaw: '[]',
          archivo: crearArchivo(),
        },
        contexto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('subirVersion', () => {
    const anterior = {
      id: 'doc-1',
      expedienteId: 'exp-1',
      tipo: 'ENTREVISTA_USUARIA' as const,
      version: 1,
      vigente: true,
    };
    const params = {
      expedienteId: 'exp-1',
      documentoId: 'doc-1',
      archivo: crearArchivo(),
    };

    it('lanza 404 si el documento no pertenece al expediente', async () => {
      documentosRepository.buscarParaVersionar.mockResolvedValue(null);

      await expect(
        service.subirVersion(params, contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
    });

    it('rechaza versionar un formato de atención psicológica', async () => {
      documentosRepository.buscarParaVersionar.mockResolvedValue({
        ...anterior,
        tipo: 'FORMATO_ATENCION_PSICOLOGICA',
      });

      await expect(
        service.subirVersion(params, contexto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lanza 409 si la versión indicada ya no es la vigente', async () => {
      documentosRepository.buscarParaVersionar.mockResolvedValue({
        ...anterior,
        vigente: false,
      });

      await expect(
        service.subirVersion(params, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
    });

    it('si otra subida ganó la carrera, responde 409 y limpia R2', async () => {
      documentosRepository.buscarParaVersionar.mockResolvedValue(anterior);
      documentosRepository.crearVersion.mockRejectedValue(
        new DocumentoYaReemplazadoError(),
      );

      await expect(
        service.subirVersion(params, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(objectStorage.eliminarObjeto).toHaveBeenCalledWith(
        expect.stringMatching(/^expedientes\/exp-1\//),
      );
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('camino feliz: crea la versión siguiente y audita sin datos personales', async () => {
      documentosRepository.buscarParaVersionar.mockResolvedValue(anterior);
      documentosRepository.crearVersion.mockResolvedValue({
        id: 'doc-2',
        tipo: 'ENTREVISTA_USUARIA',
        version: 2,
        nombreArchivo: 'documento.pdf',
        tamanioBytes: 1024,
        createdAt: new Date('2026-09-20T12:00:00Z'),
      });

      await service.subirVersion(params, contexto);

      expect(documentosRepository.crearVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          anterior,
          subidoPorId: contexto.usuarioId,
          claveR2: expect.stringMatching(/^expedientes\/exp-1\//) as string,
        }),
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DOCUMENTO_VERSION_SUBIDA',
          entidadId: 'doc-2',
          detalles: {
            expedienteId: 'exp-1',
            tipo: 'ENTREVISTA_USUARIA',
            version: 2,
            reemplazaAId: 'doc-1',
          },
        }),
      );
    });
  });

  describe('listarVersiones', () => {
    it('lanza 404 si el documento no pertenece al expediente', async () => {
      documentosRepository.listarVersiones.mockResolvedValue(null);

      await expect(
        service.listarVersiones('exp-1', 'doc-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('obtenerUrl', () => {
    it('lanza 404 si el documento no existe en ese expediente', async () => {
      documentosRepository.buscarParaDescarga.mockResolvedValue(null);

      await expect(
        service.obtenerUrl('exp-1', 'doc-x', false, contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(objectStorage.generarUrlDescarga).not.toHaveBeenCalled();
    });

    it('genera la URL firmada y audita la descarga', async () => {
      documentosRepository.buscarParaDescarga.mockResolvedValue({
        claveR2: 'expedientes/exp-1/archivo',
        nombreArchivo: 'documento.pdf',
        mimeType: 'application/pdf',
      });

      const resultado = await service.obtenerUrl(
        'exp-1',
        'doc-1',
        false,
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

    it('con inline genera una URL de vista previa y audita la visualización', async () => {
      documentosRepository.buscarParaDescarga.mockResolvedValue({
        claveR2: 'expedientes/exp-1/archivo',
        nombreArchivo: 'documento.pdf',
        mimeType: 'application/pdf',
      });

      const resultado = await service.obtenerUrl(
        'exp-1',
        'doc-1',
        true,
        contexto,
      );

      expect(objectStorage.generarUrlVistaPrevia).toHaveBeenCalledWith(
        'expedientes/exp-1/archivo',
        'application/pdf',
      );
      expect(objectStorage.generarUrlDescarga).not.toHaveBeenCalled();
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'DOCUMENTO_VISUALIZADO' }),
      );
      expect(resultado).toEqual({ url: 'https://vista.firmada/x' });
    });

    it('con inline pero un MIME fuera de la lista blanca, solo permite descargar', async () => {
      documentosRepository.buscarParaDescarga.mockResolvedValue({
        claveR2: 'expedientes/exp-1/archivo',
        nombreArchivo: 'documento.html',
        mimeType: 'text/html',
      });

      await service.obtenerUrl('exp-1', 'doc-1', true, contexto);

      expect(objectStorage.generarUrlVistaPrevia).not.toHaveBeenCalled();
      expect(objectStorage.generarUrlDescarga).toHaveBeenCalled();
    });
  });
});

describe('construirFilasDocumentos', () => {
  it('un registro EXTERNA solo muestra entrevista y acciones realizadas', () => {
    const filas = construirFilasDocumentos(expedienteExterna, []);

    expect(filas.map((fila) => fila.tipo)).toEqual([
      'ENTREVISTA_USUARIA',
      'ACCIONES_REALIZADAS',
    ]);
    expect(filas.map((fila) => fila.requerido)).toEqual([true, false]);
    expect(filas.every((fila) => fila.estado === 'FALTANTE')).toBe(true);
  });

  it('un registro INTERNA sin egreso marca el convenio de egreso como "aún no aplica"', () => {
    const filas = construirFilasDocumentos(
      { ...expedienteExterna, tipoRegistro: 'INTERNA' },
      [crearVigente({ areasVisibles: ['JURIDICO'] })],
    );

    const porTipo = Object.fromEntries(filas.map((fila) => [fila.tipo, fila]));
    expect(porTipo.ENTREVISTA_USUARIA.estado).toBe('SUBIDO');
    expect(porTipo.ENTREVISTA_USUARIA.areasVisibles).toEqual(['JURIDICO']);
    expect(porTipo.ENTREVISTA_USUARIA.vigente).not.toHaveProperty(
      'areasVisibles',
    );
    expect(porTipo.CONVENIO_INGRESO.requerido).toBe(true);
    expect(porTipo.CONVENIO_EGRESO.estado).toBe('AUN_NO_APLICA');
    expect(porTipo.CONVENIO_EGRESO.requerido).toBe(false);
  });

  it('con egreso registrado, el convenio de egreso pasa a requerido y faltante', () => {
    const filas = construirFilasDocumentos(
      {
        ...expedienteExterna,
        tipoRegistro: 'INTERNA',
        tieneEgresoAlbergue: true,
      },
      [],
    );

    const egreso = filas.find((fila) => fila.tipo === 'CONVENIO_EGRESO');
    expect(egreso).toMatchObject({ estado: 'FALTANTE', requerido: true });
  });
});
