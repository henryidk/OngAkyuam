/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { AreasService } from './areas.service';
import type { IAreasRepository } from './interfaces/areas-repository.interface';
import type { IObjectStorage } from '../storage/interfaces/object-storage.interface';
import type { AuditService } from '../auth/services/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

describe('AreasService', () => {
  let service: AreasService;
  let areasRepository: jest.Mocked<IAreasRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let auditService: jest.Mocked<AuditService>;

  const usuario: AuthenticatedUser = {
    id: 'usuario-1',
    username: 'juridico',
    nombreCompleto: 'Usuaria de prueba',
    rol: 'JURIDICO',
    mustChangePassword: false,
  };

  const contexto = {
    usuarioId: 'usuario-1',
    username: 'juridico',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    areasRepository = {
      listarPorArea: jest.fn(),
      buscarConAcceso: jest.fn(),
      buscarDocumentoVisible: jest.fn(),
    };
    objectStorage = {
      subirObjeto: jest.fn(),
      eliminarObjeto: jest.fn(),
      generarUrlDescarga: jest
        .fn()
        .mockResolvedValue('https://r2.example/firmada'),
      generarUrlVistaPrevia: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new AreasService(areasRepository, objectStorage, auditService);
  });

  describe('obtenerDetalle', () => {
    it('lanza ForbiddenException si el expediente no existe o no fue referido a esta área', async () => {
      areasRepository.buscarConAcceso.mockResolvedValue(null);

      await expect(
        service.obtenerDetalle('expediente-ajeno', usuario, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('obtenerUrlDescarga — sin IDOR', () => {
    it('lanza ForbiddenException si el documento no existe, no es del expediente o no es visible para esta área', async () => {
      areasRepository.buscarDocumentoVisible.mockResolvedValue(null);

      await expect(
        service.obtenerUrlDescarga(
          'expediente-1',
          'documento-ajeno',
          usuario,
          contexto,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(objectStorage.generarUrlDescarga).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('genera la URL firmada y audita la descarga como DOCUMENTO_DESCARGADO', async () => {
      areasRepository.buscarDocumentoVisible.mockResolvedValue({
        claveR2: 'expedientes/expediente-1/clave-real',
        nombreArchivo: 'entrevista.pdf',
      });

      const resultado = await service.obtenerUrlDescarga(
        'expediente-1',
        'documento-1',
        usuario,
        contexto,
      );

      expect(resultado.url).toBe('https://r2.example/firmada');
      expect(objectStorage.generarUrlDescarga).toHaveBeenCalledWith(
        'expedientes/expediente-1/clave-real',
        'entrevista.pdf',
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DOCUMENTO_DESCARGADO',
          entidad: 'Documento',
          entidadId: 'documento-1',
          detalles: { expedienteId: 'expediente-1', area: 'JURIDICO' },
        }),
      );
    });
  });
});
