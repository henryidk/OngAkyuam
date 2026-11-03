/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PersonalService } from './personal.service';
import type { IPersonalRepository } from './interfaces/personal-repository.interface';
import type { AuditService } from '../auth/services/audit.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

describe('PersonalService', () => {
  let service: PersonalService;
  let personalRepository: jest.Mocked<IPersonalRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'usuario-1',
    username: 'admin',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function usuario(rol: AuthenticatedUser['rol']): AuthenticatedUser {
    return {
      id: 'usuario-1',
      username: 'usuario',
      nombreCompleto: 'Usuaria de prueba',
      rol,
      mustChangePassword: false,
    };
  }

  beforeEach(() => {
    personalRepository = {
      listar: jest.fn().mockResolvedValue([]),
      crear: jest.fn(),
      editar: jest.fn(),
      buscarActivo: jest.fn(),
      buscarPorId: jest.fn().mockResolvedValue({
        nombre: 'Nombre anterior',
        activo: true,
        usuarioId: null,
      }),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new PersonalService(personalRepository, auditService);
  });

  describe('listar — alcance por rol', () => {
    it('Administración puede pedir cualquier área y ve inactivos', async () => {
      await service.listar(usuario('ADMINISTRACION'), {
        area: 'PSICOLOGIA',
        tipo: undefined,
      });

      expect(personalRepository.listar).toHaveBeenCalledWith({
        area: 'PSICOLOGIA',
        tipo: undefined,
        soloActivo: false,
      });
    });

    it('un rol de área ignora el área pedida y solo ve su propio personal activo', async () => {
      await service.listar(usuario('JURIDICO'), {
        area: 'PSICOLOGIA',
        tipo: 'ABOGADA',
      });

      expect(personalRepository.listar).toHaveBeenCalledWith({
        area: 'JURIDICO',
        tipo: 'ABOGADA',
        soloActivo: true,
      });
    });
  });

  describe('crear — validación de catálogo (OCP)', () => {
    it('rechaza un cargo de jurídico que no está en su catálogo', async () => {
      await expect(
        service.crear(
          { area: 'JURIDICO', tipo: 'PASANTE', nombre: 'Nombre' },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(personalRepository.crear).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('acepta cualquier cargo no vacío para un área sin catálogo definido todavía', async () => {
      personalRepository.crear.mockResolvedValue({
        id: 'p-1',
        area: 'PSICOLOGIA',
        tipo: 'PSICOLOGA_CLINICA',
        nombre: 'Nombre',
        activo: true,
      });

      const resultado = await service.crear(
        { area: 'PSICOLOGIA', tipo: 'PSICOLOGA_CLINICA', nombre: 'Nombre' },
        contexto,
      );

      expect(resultado.id).toBe('p-1');
      expect(personalRepository.crear).toHaveBeenCalledWith({
        area: 'PSICOLOGIA',
        tipo: 'PSICOLOGA_CLINICA',
        nombre: 'Nombre',
      });
    });

    it('crea un cargo válido de jurídico y audita sin incluir el nombre', async () => {
      personalRepository.crear.mockResolvedValue({
        id: 'p-2',
        area: 'JURIDICO',
        tipo: 'ABOGADA',
        nombre: 'Nombre Confidencial',
        activo: true,
      });

      await service.crear(
        { area: 'JURIDICO', tipo: 'ABOGADA', nombre: 'Nombre Confidencial' },
        contexto,
      );

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'PERSONAL_CREADO',
          detalles: { area: 'JURIDICO', tipo: 'ABOGADA' },
        }),
      );
    });
  });

  describe('editar', () => {
    it('lanza NotFoundException si el id no existe', async () => {
      personalRepository.buscarPorId.mockResolvedValue(null);

      await expect(
        service.editar('no-existe', { nombre: 'X', activo: false }, contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(auditService.registrar).not.toHaveBeenCalled();
      expect(personalRepository.editar).not.toHaveBeenCalled();
    });

    it.each([
      ['el nombre', { nombre: 'Otro nombre', activo: true }],
      ['el estado', { nombre: 'Nombre de la cuenta', activo: false }],
    ])(
      'una ficha enlazada a una cuenta no cambia %s por su cuenta (409)',
      async (_campo, datos) => {
        personalRepository.buscarPorId.mockResolvedValue({
          nombre: 'Nombre de la cuenta',
          activo: true,
          usuarioId: 'cuenta-1',
        });

        await expect(
          service.editar('p-1', datos, contexto),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(personalRepository.editar).not.toHaveBeenCalled();
        expect(auditService.registrar).not.toHaveBeenCalled();
      },
    );

    it('edita y audita solo el estado activo, sin el nombre', async () => {
      personalRepository.editar.mockResolvedValue({
        id: 'p-1',
        area: 'JURIDICO',
        tipo: 'ABOGADA',
        nombre: 'Nuevo nombre',
        activo: false,
      });

      await service.editar(
        'p-1',
        { nombre: 'Nuevo nombre', activo: false },
        contexto,
      );

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'PERSONAL_EDITADO',
          detalles: { activo: false },
        }),
      );
    });
  });
});
