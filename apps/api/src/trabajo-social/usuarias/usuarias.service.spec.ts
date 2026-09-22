/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsuariasService } from './usuarias.service';
import type { IUsuariasRepository } from './interfaces/usuarias-repository.interface';
import type { AuditService } from '../../auth/services/audit.service';
import type {
  UsuariaExpedienteHub,
  EditarIdentidadUsuariaInput,
} from '@akyuam/shared';

describe('UsuariasService', () => {
  let service: UsuariasService;
  let usuariasRepository: jest.Mocked<IUsuariasRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function hub(
    overrides: Partial<UsuariaExpedienteHub> = {},
  ): UsuariaExpedienteHub {
    return {
      id: 'u-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      nombres: 'Maria',
      apellidos: 'Perez',
      dpi: '1234567890123',
      telefono: '12345678',
      direccion: 'Zona 1',
      fechaNacimiento: '1990-01-01',
      grupoEtnico: 'LADINO',
      municipio: 'COBAN',
      departamentoOtro: null,
      municipioOtro: null,
      ubicacionGeografica: 'Zona 1',
      casos: [],
      ...overrides,
    };
  }

  function identidadInput(
    overrides: Partial<EditarIdentidadUsuariaInput> = {},
  ): EditarIdentidadUsuariaInput {
    return {
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
      ...overrides,
    };
  }

  beforeEach(() => {
    usuariasRepository = {
      buscarPorDpi: jest.fn(),
      buscarPorNombre: jest.fn(),
      obtenerHub: jest.fn(),
      existeDpi: jest.fn().mockResolvedValue(false),
      actualizarIdentidad: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new UsuariasService(usuariasRepository, auditService);
  });

  describe('buscar', () => {
    it('rechaza buscar sin dpi ni nombre', async () => {
      await expect(service.buscar({}, contexto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(usuariasRepository.buscarPorNombre).not.toHaveBeenCalled();
    });

    it('rechaza buscar por nombre con menos de 3 caracteres', async () => {
      await expect(
        service.buscar({ nombre: 'ab' }, contexto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usuariasRepository.buscarPorNombre).not.toHaveBeenCalled();
    });

    it('busca por DPI exacto y audita solo el conteo de resultados, nunca el DPI', async () => {
      usuariasRepository.buscarPorDpi.mockResolvedValue({
        id: 'u-1',
        nombres: 'Maria',
        apellidos: 'Perez',
        dpi: '1234567890123',
        fechaNacimiento: '1990-01-01',
      });

      const resultado = await service.buscar(
        { dpi: '1234567890123' },
        contexto,
      );

      expect(resultado).toHaveLength(1);
      const detalles = auditService.registrar.mock.calls[0][0].detalles;
      expect(JSON.stringify(detalles)).not.toContain('1234567890123');
      expect(detalles).toEqual({ resultados: 1 });
    });

    it('busca por nombre difuso cuando no viene dpi', async () => {
      usuariasRepository.buscarPorNombre.mockResolvedValue([]);

      await service.buscar({ nombre: 'Maria Perez' }, contexto);

      expect(usuariasRepository.buscarPorNombre).toHaveBeenCalledWith(
        'Maria Perez',
        20,
      );
    });
  });

  describe('obtenerHub', () => {
    it('lanza 404 si la usuaria no existe', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(null);

      await expect(service.obtenerHub('u-x', contexto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('devuelve el hub y audita la consulta', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(hub());

      const resultado = await service.obtenerHub('u-1', contexto);

      expect(resultado.id).toBe('u-1');
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'EXPEDIENTE_CONSULTADO',
          entidad: 'Usuaria',
        }),
      );
    });
  });

  describe('actualizarIdentidad', () => {
    it('lanza 404 si la usuaria no existe', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(null);

      await expect(
        service.actualizarIdentidad('u-x', identidadInput(), contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(usuariasRepository.actualizarIdentidad).not.toHaveBeenCalled();
    });

    it('rechaza DPI ya usado por otra usuaria', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(hub());
      usuariasRepository.existeDpi.mockResolvedValue(true);

      await expect(
        service.actualizarIdentidad(
          'u-1',
          identidadInput({ dpi: '9999999999999' }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usuariasRepository.actualizarIdentidad).not.toHaveBeenCalled();
    });

    it('actualiza y audita solo los nombres de los campos que cambiaron, nunca sus valores', async () => {
      usuariasRepository.obtenerHub.mockResolvedValue(
        hub({ telefono: '00000000' }),
      );
      usuariasRepository.actualizarIdentidad.mockResolvedValue(
        hub({ telefono: '12345678' }),
      );

      await service.actualizarIdentidad(
        'u-1',
        identidadInput({ telefono: '12345678' }),
        contexto,
      );

      const detalles = auditService.registrar.mock.calls[0][0].detalles as {
        campos: string[];
      };
      expect(detalles.campos).toEqual(['telefono']);
    });
  });
});
