/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { AreasService } from './areas.service';
import type {
  ExpedienteReferidoArea,
  IAreasRepository,
} from './interfaces/areas-repository.interface';
import { PoliticasAcceso } from './politicas/politicas-acceso';
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
      buscarReferido: jest.fn(),
      buscarDocumentoDeReferido: jest.fn(),
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

    service = new AreasService(
      areasRepository,
      objectStorage,
      auditService,
      new PoliticasAcceso(),
    );
  });

  describe('obtenerDetalle', () => {
    it('lanza ForbiddenException si el expediente no existe o no fue referido a esta área', async () => {
      areasRepository.buscarReferido.mockResolvedValue(null);

      await expect(
        service.obtenerDetalle('expediente-ajeno', usuario, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('Jurídico recibe datos del caso y formularios de TS aunque no estén habilitados', async () => {
      areasRepository.buscarReferido.mockResolvedValue(
        expedienteReferido(false),
      );

      const detalle = await service.obtenerDetalle(
        'expediente-1',
        usuario,
        contexto,
      );

      expect(detalle.datosCaso).not.toBeNull();
      expect(detalle.documentos.map((documento) => documento.id)).toEqual([
        'doc-privado',
        'doc-psicologia',
      ]);
      expect(detalle.documentos[0]).not.toHaveProperty('areasVisibles');
    });

    it('Psicología no recibe datos del caso ni documentos privados si TS no los habilitó', async () => {
      areasRepository.buscarReferido.mockResolvedValue(
        expedienteReferido(false),
      );

      const detalle = await service.obtenerDetalle(
        'expediente-1',
        { ...usuario, rol: 'PSICOLOGIA' },
        contexto,
      );

      expect(detalle.datosCaso).toBeNull();
      expect(detalle.documentos.map((documento) => documento.id)).toEqual([
        'doc-psicologia',
      ]);
    });

    it('Médica sí recibe datos del caso cuando puedeVerDatosCaso = true', async () => {
      areasRepository.buscarReferido.mockResolvedValue(
        expedienteReferido(true),
      );

      const detalle = await service.obtenerDetalle(
        'expediente-1',
        { ...usuario, rol: 'MEDICA' },
        contexto,
      );

      expect(detalle.datosCaso?.observaciones).toBe('Observación de prueba');
      expect(detalle.documentos).toEqual([]);
    });
  });

  describe('obtenerUrlDescarga — sin IDOR', () => {
    it('lanza ForbiddenException si el documento no existe, no es del expediente o no es visible para esta área', async () => {
      areasRepository.buscarDocumentoDeReferido.mockResolvedValue(null);

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

    it('lanza ForbiddenException si la política del área no permite ver el documento', async () => {
      areasRepository.buscarDocumentoDeReferido.mockResolvedValue({
        claveR2: 'expedientes/expediente-1/clave-real',
        nombreArchivo: 'entrevista.pdf',
        tipo: 'ENTREVISTA_USUARIA',
        areasVisibles: [],
      });

      await expect(
        service.obtenerUrlDescarga(
          'expediente-1',
          'documento-1',
          { ...usuario, rol: 'PSICOLOGIA' },
          contexto,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(objectStorage.generarUrlDescarga).not.toHaveBeenCalled();
    });

    it('genera la URL firmada y audita la descarga como DOCUMENTO_DESCARGADO', async () => {
      // Jurídico: sin visibilidad explícita, igual puede descargar un formulario de TS.
      areasRepository.buscarDocumentoDeReferido.mockResolvedValue({
        claveR2: 'expedientes/expediente-1/clave-real',
        nombreArchivo: 'entrevista.pdf',
        tipo: 'ENTREVISTA_USUARIA',
        areasVisibles: [],
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

/** Datos ficticios: un formulario de TS sin habilitar y un documento visible para Psicología. */
function expedienteReferido(
  puedeVerDatosCaso: boolean,
): ExpedienteReferidoArea {
  return {
    id: 'expediente-1',
    numero: '01-2026',
    fecha: '2026-01-15',
    municipio: null,
    tipoRegistro: 'EXTERNA',
    usuariaNombreCompleto: 'Nombre Ficticio',
    usuaria: {
      nombres: 'Nombre',
      apellidos: 'Ficticio',
      dpi: null,
      telefono: null,
      direccion: null,
      fechaNacimiento: '1990-01-01',
      grupoEtnico: 'MESTIZO',
      ubicacionGeografica: null,
      departamentoOtro: null,
      municipioOtro: null,
    },
    referido: { puedeVerDatosCaso },
    datosCaso: {
      tipologiaDelito: ['VIOLENCIA_FISICA'],
      observaciones: 'Observación de prueba',
      agresor: null,
    },
    ninos: [],
    documentos: [
      {
        id: 'doc-privado',
        tipo: 'ENTREVISTA_USUARIA',
        nombreArchivo: 'entrevista.pdf',
        tamanioBytes: 10,
        createdAt: '2026-01-15T00:00:00.000Z',
        areasVisibles: [],
      },
      {
        id: 'doc-psicologia',
        tipo: 'ACCIONES_REALIZADAS',
        nombreArchivo: 'acciones.pdf',
        tamanioBytes: 10,
        createdAt: '2026-01-15T00:00:00.000Z',
        areasVisibles: ['PSICOLOGIA'],
      },
    ],
  };
}
