/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JuridicoService } from './juridico.service';
import type { IProcesosJuridicosRepository } from './interfaces/procesos-juridicos-repository.interface';
import type { INotasAvanceRepository } from './interfaces/notas-avance-repository.interface';
import type { IDocumentosProcesoRepository } from './interfaces/documentos-proceso-repository.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import type { IPersonalRepository } from '../personal/interfaces/personal-repository.interface';
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

describe('JuridicoService', () => {
  let service: JuridicoService;
  let procesosRepository: jest.Mocked<IProcesosJuridicosRepository>;
  let notasRepository: jest.Mocked<INotasAvanceRepository>;
  let documentosRepository: jest.Mocked<IDocumentosProcesoRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let personalRepository: jest.Mocked<IPersonalRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'usuario-1',
    username: 'abogada',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    procesosRepository = {
      buscarExpedienteConAcceso: jest.fn(),
      listarPorExpediente: jest.fn(),
      crear: jest.fn(),
      buscarAccesoProceso: jest.fn(),
      obtenerDetalle: jest.fn(),
      actualizarAsignacion: jest.fn(),
      cerrar: jest.fn(),
      registrarAbandono: jest.fn(),
      listarGlobalPaginado: jest.fn(),
    };
    notasRepository = {
      crear: jest.fn(),
      listarPorProceso: jest.fn(),
    };
    documentosRepository = {
      crear: jest.fn(),
      listarPorProceso: jest.fn(),
      buscarParaDescarga: jest.fn(),
    };
    objectStorage = {
      subirObjeto: jest.fn().mockResolvedValue(undefined),
      eliminarObjeto: jest.fn().mockResolvedValue(undefined),
      generarUrlDescarga: jest
        .fn()
        .mockResolvedValue('https://descarga.firmada/x'),
    };
    personalRepository = {
      listar: jest.fn(),
      crear: jest.fn(),
      editar: jest.fn(),
      // Por defecto, cualquier abogada/procuradora referenciada existe y está activa —
      // los tests que necesitan lo contrario lo sobreescriben explícitamente.
      buscarActivo: jest.fn().mockResolvedValue({ id: 'personal-1' }),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new JuridicoService(
      procesosRepository,
      notasRepository,
      documentosRepository,
      objectStorage,
      personalRepository,
      auditService,
    );
  });

  describe('acceso a nivel de expediente', () => {
    it('rechaza listar procesos si el expediente no fue referido a JURIDICO', async () => {
      procesosRepository.buscarExpedienteConAcceso.mockResolvedValue(null);

      await expect(
        service.listarPorExpediente('exp-ajeno'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(procesosRepository.listarPorExpediente).not.toHaveBeenCalled();
    });

    it('rechaza crear un proceso si el expediente no fue referido a JURIDICO', async () => {
      procesosRepository.buscarExpedienteConAcceso.mockResolvedValue(null);

      await expect(
        service.crearProceso(
          'exp-ajeno',
          {
            tipo: 'DIVORCIO_MUTUO_ACUERDO',
            abogadaId: '',
            procuradoraId: '',
            fechaInicio: '2026-01-01',
          },
          contexto,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(procesosRepository.crear).not.toHaveBeenCalled();
    });

    it('rechaza crear un proceso si la abogada seleccionada no existe o no está activa', async () => {
      procesosRepository.buscarExpedienteConAcceso.mockResolvedValue({
        id: 'exp-1',
      });
      personalRepository.buscarActivo.mockResolvedValue(null);

      await expect(
        service.crearProceso(
          'exp-1',
          {
            tipo: 'DIVORCIO_MUTUO_ACUERDO',
            abogadaId: 'no-existe',
            procuradoraId: '',
            fechaInicio: '2026-01-01',
          },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.crear).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('rechaza crear un proceso si la FK falla pese a la validación previa (defensa en profundidad)', async () => {
      procesosRepository.buscarExpedienteConAcceso.mockResolvedValue({
        id: 'exp-1',
      });
      procesosRepository.crear.mockResolvedValue(null);

      await expect(
        service.crearProceso(
          'exp-1',
          {
            tipo: 'DIVORCIO_MUTUO_ACUERDO',
            abogadaId: 'personal-1',
            procuradoraId: '',
            fechaInicio: '2026-01-01',
          },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('IDOR — acceso a nivel de proceso ya existente', () => {
    // Un procesoId válido pero de un expediente ajeno (no referido a JURIDICO para este
    // usuario) debe rechazarse igual que un procesoId inexistente — mismo 403 uniforme,
    // sin distinguir los dos casos (ver planjuridico.md punto 12).
    const casos: Array<[string, () => Promise<unknown>]> = [
      [
        'obtenerDetalle',
        () => service.obtenerDetalle('proceso-ajeno', contexto),
      ],
      [
        'editarAsignacion',
        () =>
          service.editarAsignacion(
            'proceso-ajeno',
            { abogadaId: '', procuradoraId: '' },
            contexto,
          ),
      ],
      [
        'cerrarProceso',
        () =>
          service.cerrarProceso(
            'proceso-ajeno',
            { fechaCierre: '2026-01-01' },
            contexto,
          ),
      ],
      [
        'agregarNota',
        () =>
          service.agregarNota('proceso-ajeno', { contenido: 'nota' }, contexto),
      ],
      [
        'registrarAbandono',
        () =>
          service.registrarAbandono(
            'proceso-ajeno',
            { fecha: '2026-01-01', motivo: '' },
            contexto,
          ),
      ],
      [
        'subirDocumento',
        () =>
          service.subirDocumento(
            'proceso-ajeno',
            { nombreVisible: 'Demanda', archivo: crearArchivo() },
            contexto,
          ),
      ],
      [
        'obtenerUrlDescarga',
        () => service.obtenerUrlDescarga('proceso-ajeno', 'doc-1', contexto),
      ],
    ];

    it.each(casos)(
      '%s rechaza con 403 si el proceso no pertenece a un expediente referido',
      async (_nombre, ejecutar) => {
        procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

        await expect(ejecutar()).rejects.toBeInstanceOf(ForbiddenException);
        expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
        expect(auditService.registrar).not.toHaveBeenCalled();
      },
    );

    it('rechaza la descarga de un documento que no pertenece a ese proceso (IDOR a nivel de documento)', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue({
        id: 'proceso-1',
        expedienteId: 'exp-1',
      });
      documentosRepository.buscarParaDescarga.mockResolvedValue(null);

      await expect(
        service.obtenerUrlDescarga(
          'proceso-1',
          'doc-de-otro-proceso',
          contexto,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(objectStorage.generarUrlDescarga).not.toHaveBeenCalled();
    });
  });

  describe('caminos felices y auditoría sin texto libre', () => {
    beforeEach(() => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue({
        id: 'proceso-1',
        expedienteId: 'exp-1',
      });
    });

    it('agregarNota audita sin incluir el contenido de la nota en detalles', async () => {
      notasRepository.crear.mockResolvedValue({
        id: 'nota-1',
        contenido: 'contenido sensible de la usuaria',
        registradoPor: 'Abogada',
        createdAt: '2026-09-15T12:00:00.000Z',
      });

      await service.agregarNota(
        'proceso-1',
        { contenido: 'contenido sensible de la usuaria' },
        contexto,
      );

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'NOTA_AVANCE_AGREGADA',
          entidadId: 'nota-1',
          detalles: { procesoId: 'proceso-1' },
        }),
      );
    });

    it('registrarAbandono audita sin incluir el motivo en detalles', async () => {
      await service.registrarAbandono(
        'proceso-1',
        { fecha: '2026-01-01', motivo: 'motivo sensible' },
        contexto,
      );

      expect(procesosRepository.registrarAbandono).toHaveBeenCalledWith(
        expect.objectContaining({
          procesoId: 'proceso-1',
          motivo: 'motivo sensible',
        }),
      );
      const llamada = auditService.registrar.mock.calls[0][0];
      expect(llamada.accion).toBe('ABANDONO_REGISTRADO');
      expect(JSON.stringify(llamada.detalles ?? {})).not.toContain(
        'motivo sensible',
      );
    });

    it('obtenerDetalle compone proceso + notas + documentos y audita la consulta', async () => {
      procesosRepository.obtenerDetalle.mockResolvedValue({
        id: 'proceso-1',
        expedienteId: 'exp-1',
        tipo: 'DIVORCIO_MUTUO_ACUERDO',
        estado: 'INICIADO',
        abogada: null,
        procuradora: null,
        fechaInicio: '2026-01-01',
        fechaCierre: null,
        abandono: null,
      });
      notasRepository.listarPorProceso.mockResolvedValue([]);
      documentosRepository.listarPorProceso.mockResolvedValue([]);

      const detalle = await service.obtenerDetalle('proceso-1', contexto);

      expect(detalle.notas).toEqual([]);
      expect(detalle.documentos).toEqual([]);
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'PROCESO_JURIDICO_CONSULTADO' }),
      );
    });

    it('subirDocumento limpia el objeto en R2 si falla la escritura en base de datos', async () => {
      documentosRepository.crear.mockRejectedValue(
        new Error('fallo de base de datos'),
      );

      await expect(
        service.subirDocumento(
          'proceso-1',
          { nombreVisible: 'Demanda inicial', archivo: crearArchivo() },
          contexto,
        ),
      ).rejects.toThrow('fallo de base de datos');

      expect(objectStorage.eliminarObjeto).toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('subirDocumento rechaza un MIME type fuera de la lista blanca', async () => {
      await expect(
        service.subirDocumento(
          'proceso-1',
          {
            nombreVisible: 'Demanda inicial',
            archivo: crearArchivo({ mimetype: 'application/x-msdownload' }),
          },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
    });

    it('obtenerUrlDescarga audita la descarga como DOCUMENTO_PROCESO_DESCARGADO', async () => {
      documentosRepository.buscarParaDescarga.mockResolvedValue({
        claveR2: 'procesos-juridicos/exp-1/proceso-1/archivo',
        nombreVisible: 'Demanda inicial',
      });

      const resultado = await service.obtenerUrlDescarga(
        'proceso-1',
        'doc-1',
        contexto,
      );

      expect(resultado).toEqual({ url: 'https://descarga.firmada/x' });
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DOCUMENTO_PROCESO_DESCARGADO',
          entidadId: 'doc-1',
        }),
      );
    });
  });
});
