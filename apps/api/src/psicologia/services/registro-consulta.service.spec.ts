/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
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
      buscarCitasSolapadas: jest.fn().mockResolvedValue([]),
      obtenerDatosParaReprogramar: jest.fn(),
      reprogramar: jest.fn(),
      registrarConsulta: jest.fn().mockResolvedValue({
        cita: crearCita(),
        pasoASeguimiento: false,
        proximaCitaId: null,
      }),
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

  describe('registrarConsulta · etapa y "¿Qué sigue?"', () => {
    const programar = {
      tipo: 'PROGRAMAR' as const,
      fechaHora: '2026-10-15T09:00',
      duracionMinutos: 45,
    };

    it('la primera sesión atendida avisa que el proceso pasó a Seguimiento', async () => {
      citasRepository.registrarConsulta.mockResolvedValue({
        cita: crearCita(),
        pasoASeguimiento: true,
        proximaCitaId: null,
      });

      const resultado = await service.registrarConsulta(
        'cita-1',
        datosBase,
        contexto,
      );

      expect(resultado).toMatchObject({
        procesoId: 'atencion-1',
        pasoASeguimiento: true,
        proximaCita: null,
      });
      expect(citasRepository.registrarConsulta).toHaveBeenCalledWith(
        expect.objectContaining({
          psicologaId: 'psicologa-a',
          estado: 'ATENDIDA',
          proximaCita: null,
        }),
      );
    });

    it('"Programar" crea la próxima cita junto con el registro, en hora de Guatemala', async () => {
      citasRepository.registrarConsulta.mockResolvedValue({
        cita: crearCita(),
        pasoASeguimiento: false,
        proximaCitaId: 'cita-2',
      });

      const resultado = await service.registrarConsulta(
        'cita-1',
        { ...datosBase, siguiente: programar },
        contexto,
      );

      expect(citasRepository.registrarConsulta).toHaveBeenCalledWith(
        expect.objectContaining({
          proximaCita: {
            fechaHora: new Date('2026-10-15T15:00:00.000Z'),
            duracionMinutos: 45,
          },
        }),
      );
      expect(resultado.proximaCita).toEqual({
        id: 'cita-2',
        procesoId: 'atencion-1',
        fechaHora: '2026-10-15T15:00:00.000Z',
      });
    });

    it('si la próxima cita se traslapa, avisa con 409 y no guarda nada', async () => {
      citasRepository.buscarCitasSolapadas.mockResolvedValue([crearCita()]);

      await expect(
        service.registrarConsulta(
          'cita-1',
          { ...datosBase, siguiente: programar },
          contexto,
        ),
      ).rejects.toMatchObject({
        response: { codigo: 'TRASLAPE_CITA' },
      });
      expect(citasRepository.registrarConsulta).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('con el traslape confirmado ya no consulta la agenda y guarda', async () => {
      await service.registrarConsulta(
        'cita-1',
        {
          ...datosBase,
          siguiente: { ...programar, confirmarTraslape: true },
        },
        contexto,
      );

      expect(citasRepository.buscarCitasSolapadas).not.toHaveBeenCalled();
      expect(citasRepository.registrarConsulta).toHaveBeenCalled();
    });

    it('un borrador no programa la próxima cita aunque venga en el formulario', async () => {
      await service.registrarConsulta(
        'cita-1',
        { ...datosBase, borrador: true, siguiente: programar },
        contexto,
      );

      expect(citasRepository.buscarCitasSolapadas).not.toHaveBeenCalled();
      expect(citasRepository.registrarConsulta).toHaveBeenCalledWith(
        expect.objectContaining({ estado: undefined, proximaCita: null }),
      );
    });

    it('"Cerrar proceso" no cierra nada desde aquí: solo guarda la sesión', async () => {
      const resultado = await service.registrarConsulta(
        'cita-1',
        { ...datosBase, siguiente: { tipo: 'CERRAR' } },
        contexto,
      );

      expect(citasRepository.registrarConsulta).toHaveBeenCalledWith(
        expect.objectContaining({ proximaCita: null }),
      );
      expect(resultado.proximaCita).toBeNull();
    });

    it('responde 409 si el proceso se cerró o la cita se movió, sin auditar un guardado', async () => {
      citasRepository.registrarConsulta.mockResolvedValue(null);

      await expect(
        service.registrarConsulta('cita-1', datosBase, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('subirDocumentoCita', () => {
    const PDF = Buffer.from('%PDF-1.7 contenido de prueba');
    function archivo(mimetype: string, buffer: Buffer): Express.Multer.File {
      return {
        mimetype,
        buffer,
        size: buffer.length,
        originalname: 'formato.pdf',
      } as Express.Multer.File;
    }

    it('rechaza un archivo cuyo contenido no es del tipo que declara', async () => {
      await expect(
        service.subirDocumentoCita(
          'cita-1',
          archivo('application/pdf', Buffer.from('MZ ejecutable disfrazado')),
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
    });

    it('rechaza un tipo que no está en la lista blanca', async () => {
      await expect(
        service.subirDocumentoCita(
          'cita-1',
          archivo('text/html', Buffer.from('<html>')),
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
    });

    it('no sube nada a la cita de otra psicóloga', async () => {
      acceso.exigirAccesoCita.mockRejectedValue(new ForbiddenException());

      await expect(
        service.subirDocumentoCita(
          'cita-ajena',
          archivo('application/pdf', PDF),
          contexto,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(objectStorage.subirObjeto).not.toHaveBeenCalled();
      expect(documentosRepository.crearDocumento).not.toHaveBeenCalled();
    });

    it('guarda un PDF real con una clave que no lleva el nombre del archivo', async () => {
      documentosRepository.crearDocumento.mockResolvedValue({
        id: 'doc-1',
        tipo: 'FORMATO_ATENCION_PSICOLOGICA',
        nombreArchivo: 'formato.pdf',
        tamanioBytes: PDF.length,
        createdAt: '2026-10-08T00:00:00.000Z',
      });

      await service.subirDocumentoCita(
        'cita-1',
        archivo('application/pdf', PDF),
        contexto,
      );

      const [clave] = objectStorage.subirObjeto.mock.calls[0];
      expect(clave).toMatch(/^citas-psicologicas\/exp-1\/cita-1\//);
      expect(clave).not.toContain('formato');
      const auditado = auditService.registrar.mock.calls[0][0];
      expect(JSON.stringify(auditado.detalles)).not.toContain('formato');
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
