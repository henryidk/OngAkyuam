/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ExpedientesService } from './expedientes.service';
import {
  DpiUsuariaDuplicadoError,
  UsuariaNoEncontradaError,
} from './interfaces/expedientes-repository.interface';
import type { IExpedientesRepository } from './interfaces/expedientes-repository.interface';
import type { AuditService } from '../auth/services/audit.service';
import type {
  CrearExpedienteInput,
  DatosCaso,
  ExpedienteCreado,
  ExpedienteDetalleCaso,
} from '@akyuam/shared';

describe('ExpedientesService', () => {
  let service: ExpedientesService;
  let expedientesRepository: jest.Mocked<IExpedientesRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function resultado(
    overrides: Partial<ExpedienteCreado> = {},
  ): ExpedienteCreado {
    return {
      id: 'exp-1',
      numero: '01-2026',
      usuariaId: 'u-1',
      usuariaNombreCompleto: 'Maria Perez',
      fecha: '2026-01-01',
      municipio: 'COBAN',
      tipoRegistro: 'EXTERNA',
      ...overrides,
    };
  }

  function datosCaso(overrides: Partial<DatosCaso> = {}): DatosCaso {
    return {
      fecha: '2026-01-01',
      tipologiaDelito: ['VIOLENCIA_FISICA'],
      tipoRegistro: 'EXTERNA',
      fechaIngresoAlbergue: '',
      datosAgresor: { nombres: '', apellidos: '', telefono: '', direccion: '' },
      observaciones: '',
      ninos: [],
      ...overrides,
    };
  }

  function datosNuevaUsuaria(
    overrides: Partial<CrearExpedienteInput> = {},
  ): CrearExpedienteInput {
    return {
      datosUsuaria: {
        nombres: 'Maria',
        apellidos: 'Perez',
        dpi: '1234567890123',
        telefono: '12345678',
        direccion: 'Zona 1',
        fechaNacimiento: '1990-01-01',
        grupoEtnico: 'LADINO',
        fueraDeAltaVerapaz: false,
        municipio: 'COBAN',
        departamentoOtro: '',
        municipioOtro: '',
        ubicacionGeografica: 'Zona 1',
      },
      datosCaso: datosCaso(),
      ...overrides,
    };
  }

  beforeEach(() => {
    expedientesRepository = {
      crearConUsuariaNueva: jest.fn(),
      crearParaUsuariaExistente: jest.fn(),
      obtenerDetalle: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new ExpedientesService(expedientesRepository, auditService);
  });

  describe('crear', () => {
    it('lanza 409 en vez de reconciliar en silencio cuando el DPI ya existe', async () => {
      expedientesRepository.crearConUsuariaNueva.mockRejectedValue(
        new DpiUsuariaDuplicadoError(),
      );

      await expect(
        service.crear(datosNuevaUsuaria(), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('el mensaje del 409 nunca incluye el nombre de la usuaria existente', async () => {
      expedientesRepository.crearConUsuariaNueva.mockRejectedValue(
        new DpiUsuariaDuplicadoError(),
      );

      try {
        await service.crear(datosNuevaUsuaria(), contexto);
        fail('debía lanzar ConflictException');
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictException);
        const mensaje = (error as ConflictException).message;
        expect(mensaje).not.toContain('Maria');
        expect(mensaje).not.toContain('1234567890123');
      }
    });

    it('crea el expediente y audita numero, nunca nombres/DPI', async () => {
      expedientesRepository.crearConUsuariaNueva.mockResolvedValue(resultado());

      await service.crear(datosNuevaUsuaria(), contexto);

      const detalles = auditService.registrar.mock.calls[0][0].detalles;
      expect(JSON.stringify(detalles)).not.toContain('Maria');
      expect(detalles).toEqual({ numero: '01-2026' });
    });

    it('guarda la fecha de ingreso solo si es Interna y observaciones vacías como null', async () => {
      expedientesRepository.crearConUsuariaNueva.mockResolvedValue(resultado());

      await service.crear(
        datosNuevaUsuaria({
          datosCaso: datosCaso({ fechaIngresoAlbergue: '2026-01-02' }),
        }),
        contexto,
      );
      await service.crear(
        datosNuevaUsuaria({
          datosCaso: datosCaso({
            tipoRegistro: 'INTERNA',
            fechaIngresoAlbergue: '2026-01-02',
            observaciones: 'Texto ficticio',
          }),
        }),
        contexto,
      );

      const [externa, interna] =
        expedientesRepository.crearConUsuariaNueva.mock.calls.map(
          ([params]) => params.datosCaso,
        );
      expect(externa).toMatchObject({
        fechaIngresoAlbergue: null,
        observaciones: null,
      });
      expect(interna).toMatchObject({
        fechaIngresoAlbergue: '2026-01-02',
        observaciones: 'Texto ficticio',
      });
    });

    it('crear un caso ya no refiere a ningún área (se hace desde la ficha)', async () => {
      expedientesRepository.crearConUsuariaNueva.mockResolvedValue(resultado());

      await service.crear(datosNuevaUsuaria(), contexto);

      expect(auditService.registrar).toHaveBeenCalledTimes(1);
      expect(
        expedientesRepository.crearConUsuariaNueva.mock.calls[0][0].datosCaso,
      ).not.toHaveProperty('areasReferidas');
    });
  });

  describe('crearCasoParaUsuariaExistente', () => {
    it('no pide ni acepta campos de identidad, solo datosCaso', async () => {
      expedientesRepository.crearParaUsuariaExistente.mockResolvedValue(
        resultado(),
      );

      await service.crearCasoParaUsuariaExistente('u-1', datosCaso(), contexto);

      const [usuariaId, datosEnviados] =
        expedientesRepository.crearParaUsuariaExistente.mock.calls[0];
      expect(usuariaId).toBe('u-1');
      expect(datosEnviados).not.toHaveProperty('nombres');
      expect(expedientesRepository.crearConUsuariaNueva).not.toHaveBeenCalled();
    });

    it('lanza 404 si la usuaria no existe', async () => {
      expedientesRepository.crearParaUsuariaExistente.mockRejectedValue(
        new UsuariaNoEncontradaError(),
      );

      await expect(
        service.crearCasoParaUsuariaExistente('u-x', datosCaso(), contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('audita el numero del caso creado', async () => {
      expedientesRepository.crearParaUsuariaExistente.mockResolvedValue(
        resultado(),
      );

      await service.crearCasoParaUsuariaExistente('u-1', datosCaso(), contexto);

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'EXPEDIENTE_CREADO' }),
      );
    });
  });

  describe('obtenerDetalle', () => {
    function detalle(
      overrides: Partial<ExpedienteDetalleCaso> = {},
    ): ExpedienteDetalleCaso {
      return {
        id: 'exp-1',
        numero: '01-2026',
        fecha: '2026-01-01',
        tipoRegistro: 'EXTERNA',
        tipologiaDelito: ['VIOLENCIA_FISICA'],
        usuariaId: 'u-1',
        agresor: null,
        ninos: [],
        areasReferidas: [],
        documentos: [],
        ...overrides,
      };
    }

    it('lanza 404 si el expediente no existe', async () => {
      expedientesRepository.obtenerDetalle.mockResolvedValue(null);

      await expect(
        service.obtenerDetalle('exp-x', contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('audita la consulta y devuelve el detalle', async () => {
      expedientesRepository.obtenerDetalle.mockResolvedValue(detalle());

      const resultado = await service.obtenerDetalle('exp-1', contexto);

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'EXPEDIENTE_CONSULTADO',
          entidad: 'Expediente',
          entidadId: 'exp-1',
        }),
      );
      expect(resultado).toEqual(detalle());
    });
  });
});
