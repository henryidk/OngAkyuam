/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type { CitaResumen } from '@akyuam/shared';
import { RegistroConsultaService } from './registro-consulta.service';
import type { AccesoPsicologiaService } from './acceso-psicologia.service';
import type {
  AccesoCitaPsicologica,
  ICitasPsicologicasRepository,
} from '../interfaces/citas-psicologicas-repository.interface';
import type { IDocumentosCitaRepository } from '../interfaces/documentos-cita-repository.interface';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import type { AuditService } from '../../auth/services/audit.service';

function crearCita(overrides: Partial<CitaResumen> = {}): CitaResumen {
  return {
    id: 'cita-1',
    fechaHora: '2026-10-01T15:00:00.000Z',
    modalidad: 'PRESENCIAL',
    lugar: null,
    motivo: 'Seguimiento',
    tipo: 'SEGUIMIENTO',
    duracionMinutos: 45,
    estado: 'ATENDIDA',
    observaciones: null,
    acuerdos: null,
    motivoNoAsistencia: null,
    temas: null,
    intervencion: null,
    recomendaciones: null,
    borrador: false,
    reprogramadaDesdeId: null,
    atendidoPor: 'Psicóloga A',
    documento: null,
    ...overrides,
  };
}

describe('RegistroConsultaService', () => {
  let service: RegistroConsultaService;
  let acceso: jest.Mocked<AccesoPsicologiaService>;
  let citasRepository: jest.Mocked<ICitasPsicologicasRepository>;
  let documentosRepository: jest.Mocked<IDocumentosCitaRepository>;
  let objectStorage: jest.Mocked<IObjectStorage>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'psicologa-a',
    username: 'psicologa.a',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  const accesoCita: AccesoCitaPsicologica = {
    id: 'cita-1',
    atencionId: 'atencion-1',
    expedienteId: 'exp-1',
  };

  beforeEach(() => {
    acceso = {
      exigirAccesoExpediente: jest.fn(),
      exigirAccesoCita: jest.fn().mockResolvedValue(accesoCita),
      exigirLecturaCita: jest
        .fn()
        .mockResolvedValue({ ...accesoCita, propia: true }),
      exigirReferidoPsicologia: jest.fn(),
    } as unknown as jest.Mocked<AccesoPsicologiaService>;
    citasRepository = {
      buscarAccesoCita: jest.fn(),
      buscarLecturaCita: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      listarAgenda: jest.fn(),
      buscarCitasSolapadas: jest.fn(),
      obtenerDatosParaReprogramar: jest.fn(),
      reprogramar: jest.fn(),
      registrarConsulta: jest.fn().mockResolvedValue(crearCita()),
    };
    documentosRepository = {
      crearDocumento: jest.fn(),
      buscarDocumentoParaDescarga: jest.fn(),
    };
    objectStorage = {
      subirObjeto: jest.fn(),
      eliminarObjeto: jest.fn(),
      generarUrlDescarga: jest.fn(),
      generarUrlVistaPrevia: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new RegistroConsultaService(
      acceso,
      citasRepository,
      documentosRepository,
      objectStorage,
      auditService,
    );
  });

  const datosBase = {
    estado: 'ATENDIDA' as const,
    temas: '',
    intervencion: '',
    recomendaciones: '',
    acuerdos: '',
    observaciones: '',
    motivoNoAsistencia: '',
    borrador: false,
  };

  describe('registrarConsulta', () => {
    it('propaga el 403 del guard sin llegar al repositorio', async () => {
      acceso.exigirAccesoCita.mockRejectedValue(
        new ForbiddenException('No tiene acceso a este expediente'),
      );

      await expect(
        service.registrarConsulta('cita-ajena', datosBase, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(citasRepository.registrarConsulta).not.toHaveBeenCalled();
    });

    it('al finalizar (borrador: false), envía el estado elegido al repositorio', async () => {
      await service.registrarConsulta('cita-1', datosBase, contexto);

      expect(citasRepository.registrarConsulta).toHaveBeenCalledWith(
        expect.objectContaining({ estado: 'ATENDIDA', borrador: false }),
      );
    });

    it('al guardar borrador, no cambia el estado de la cita (undefined al repositorio)', async () => {
      await service.registrarConsulta(
        'cita-1',
        { ...datosBase, borrador: true },
        contexto,
      );

      expect(citasRepository.registrarConsulta).toHaveBeenCalledWith(
        expect.objectContaining({ estado: undefined, borrador: true }),
      );
    });

    it('convierte "" en null en los campos de texto clínico', async () => {
      await service.registrarConsulta('cita-1', datosBase, contexto);

      expect(citasRepository.registrarConsulta).toHaveBeenCalledWith(
        expect.objectContaining({
          temas: null,
          intervencion: null,
          recomendaciones: null,
          acuerdos: null,
          observaciones: null,
          motivoNoAsistencia: null,
        }),
      );
    });

    it('audita REGISTRO_CONSULTA_GUARDADO sin texto clínico en detalles', async () => {
      await service.registrarConsulta(
        'cita-1',
        {
          ...datosBase,
          estado: 'NO_ASISTIO',
          motivoNoAsistencia: 'motivo sensible de la usuaria',
        },
        contexto,
      );

      const llamada = auditService.registrar.mock.calls[0][0];
      expect(llamada.accion).toBe('REGISTRO_CONSULTA_GUARDADO');
      expect(JSON.stringify(llamada.detalles ?? {})).not.toContain(
        'motivo sensible',
      );
    });
  });

  describe('obtenerUrlDescargaDocumentoCita', () => {
    const documento = {
      id: 'doc-1',
      claveR2: 'clave-de-prueba',
      nombreArchivo: 'hoja.pdf',
    };

    it('rechaza con 403 a quien no puede leer la cita, sin firmar ninguna URL', async () => {
      acceso.exigirLecturaCita.mockRejectedValue(new ForbiddenException());

      await expect(
        service.obtenerUrlDescargaDocumentoCita('cita-1', contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(acceso.exigirLecturaCita).toHaveBeenCalledWith(
        'cita-1',
        'psicologa-a',
      );
      expect(
        documentosRepository.buscarDocumentoParaDescarga,
      ).not.toHaveBeenCalled();
      expect(objectStorage.generarUrlDescarga).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('entrega el documento del proceso cerrado de una colega y lo deja anotado', async () => {
      acceso.exigirLecturaCita.mockResolvedValue({
        ...accesoCita,
        propia: false,
      });
      documentosRepository.buscarDocumentoParaDescarga.mockResolvedValue(
        documento,
      );
      objectStorage.generarUrlDescarga.mockResolvedValue('https://firmada');

      await expect(
        service.obtenerUrlDescargaDocumentoCita('cita-1', contexto),
      ).resolves.toEqual({ url: 'https://firmada' });
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'DOCUMENTO_CITA_PSICOLOGICA_DESCARGADO',
          detalles: { citaId: 'cita-1', deColega: true },
        }),
      );
    });
  });
});
