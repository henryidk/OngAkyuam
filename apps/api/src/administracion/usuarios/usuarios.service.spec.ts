/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ConflictException } from '@nestjs/common';

// `UserCacheService` importa `RedisService`, que a su vez importa `@nestjs/config`
// (paquete ESM-only) — sin este mock, cargar `UsuariosService` en el test intentaría
// resolver esa cadena bajo el entorno commonjs de Jest y fallaría al parsear el módulo.
// El mock no cambia el comportamiento probado: el service solo llama a `.invalidate()`,
// ya cubierto por el mock manual de `userCache` más abajo.
jest.mock('../../auth/services/user-cache.service', () => ({
  UserCacheService: jest.fn(),
}));

import { UsuariosService } from './usuarios.service';
import type { IUsuariosRepository } from './interfaces/usuarios-repository.interface';
import type { AuditService } from '../../auth/services/audit.service';
import type { UserCacheService } from '../../auth/services/user-cache.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import type { UsuarioAdminDto } from '@akyuam/shared';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuariosRepository: jest.Mocked<IUsuariosRepository>;
  let auditService: jest.Mocked<AuditService>;
  let userCache: jest.Mocked<UserCacheService>;
  let prisma: { refreshToken: { updateMany: jest.Mock } };

  const contexto = {
    usuarioId: 'admin-1',
    username: 'admin',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function actor(id = 'admin-1'): AuthenticatedUser {
    return {
      id,
      username: 'admin',
      nombreCompleto: 'Administradora',
      rol: 'ADMINISTRACION',
      mustChangePassword: false,
    };
  }

  function usuarioDto(
    overrides: Partial<UsuarioAdminDto> = {},
  ): UsuarioAdminDto {
    return {
      id: 'u-1',
      nombreCompleto: 'Usuaria de prueba',
      username: 'jperez',
      telefono: '12345678',
      dpi: '1234567890123',
      rol: 'JURIDICO',
      puesto: 'ABOGADA',
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date('2026-01-01'),
      personalId: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    usuariosRepository = {
      listar: jest.fn().mockResolvedValue([]),
      buscarPorId: jest.fn(),
      crear: jest.fn(),
      editar: jest.fn(),
      actualizarPassword: jest.fn(),
      setActive: jest.fn(),
      existeUsername: jest.fn().mockResolvedValue(false),
      existeDpi: jest.fn().mockResolvedValue(false),
      buscarFichaPersonal: jest.fn(),
      vincularFichaPersonal: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    userCache = {
      invalidate: jest.fn(),
    } as unknown as jest.Mocked<UserCacheService>;
    prisma = { refreshToken: { updateMany: jest.fn() } };

    service = new UsuariosService(
      usuariosRepository,
      auditService,
      userCache,
      prisma as unknown as PrismaService,
    );
  });

  describe('crear — validación de puesto (defensa en profundidad, no solo Zod)', () => {
    it('rechaza un usuario de área de atención sin puesto', async () => {
      await expect(
        service.crear(
          {
            nombreCompleto: 'X',
            telefono: '12345678',
            dpi: '1234567890123',
            username: 'nueva',
            rol: 'JURIDICO',
            puesto: undefined,
          },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usuariosRepository.crear).not.toHaveBeenCalled();
    });

    it('rechaza un usuario ADMINISTRACION con puesto presente', async () => {
      await expect(
        service.crear(
          {
            nombreCompleto: 'X',
            telefono: '12345678',
            dpi: '1234567890123',
            username: 'nueva',
            rol: 'ADMINISTRACION',
            puesto: 'DOCTORA',
          },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usuariosRepository.crear).not.toHaveBeenCalled();
    });
  });

  describe('crear — unicidad', () => {
    it('rechaza username duplicado con mensaje específico', async () => {
      usuariosRepository.existeUsername.mockResolvedValue(true);

      await expect(
        service.crear(
          {
            nombreCompleto: 'X',
            telefono: '12345678',
            dpi: '1234567890123',
            username: 'repetido',
            rol: 'JURIDICO',
            puesto: 'ABOGADA',
          },
          contexto,
        ),
      ).rejects.toThrow('El nombre de usuario ya está en uso');
      expect(usuariosRepository.crear).not.toHaveBeenCalled();
    });

    it('rechaza DPI duplicado con mensaje específico', async () => {
      usuariosRepository.existeDpi.mockResolvedValue(true);

      await expect(
        service.crear(
          {
            nombreCompleto: 'X',
            telefono: '12345678',
            dpi: '1234567890123',
            username: 'nueva',
            rol: 'JURIDICO',
            puesto: 'ABOGADA',
          },
          contexto,
        ),
      ).rejects.toThrow('El DPI ya está registrado para otro usuario');
      expect(usuariosRepository.crear).not.toHaveBeenCalled();
    });

    it('crea, audita USER_CREATED y nunca incluye la contraseña temporal en el audit log', async () => {
      usuariosRepository.crear.mockResolvedValue(usuarioDto());

      const resultado = await service.crear(
        {
          nombreCompleto: 'Jane Perez',
          telefono: '12345678',
          dpi: '1234567890123',
          username: 'jperez',
          rol: 'JURIDICO',
          puesto: 'ABOGADA',
        },
        contexto,
      );

      expect(resultado.passwordTemporal).toHaveLength(8);
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'USER_CREATED' }),
      );
      const detallesAuditados =
        auditService.registrar.mock.calls[0][0].detalles;
      expect(JSON.stringify(detallesAuditados)).not.toContain(
        resultado.passwordTemporal,
      );
    });
  });

  describe('resetearPassword — auto-protección', () => {
    it('rechaza resetear la propia contraseña y no ejecuta nada', async () => {
      await expect(
        service.resetearPassword('admin-1', actor('admin-1'), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usuariosRepository.actualizarPassword).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('resetea a otro usuario: revoca refresh tokens e invalida cache', async () => {
      usuariosRepository.buscarPorId.mockResolvedValue(
        usuarioDto({ id: 'u-2' }),
      );

      await service.resetearPassword('u-2', actor('admin-1'), contexto);

      expect(usuariosRepository.actualizarPassword).toHaveBeenCalledWith(
        'u-2',
        expect.any(String),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { usuarioId: 'u-2', revoked: false },
        data: { revoked: true, revokedAt: expect.any(Date) as Date },
      });
      expect(userCache.invalidate).toHaveBeenCalledWith('u-2');
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'PASSWORD_RESET_BY_ADMIN' }),
      );
    });
  });

  describe('desactivar — auto-protección', () => {
    it('rechaza desactivar la propia cuenta y no ejecuta nada', async () => {
      await expect(
        service.desactivar('admin-1', actor('admin-1'), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usuariosRepository.setActive).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('desactiva a otro usuario: revoca refresh tokens e invalida cache', async () => {
      usuariosRepository.setActive.mockResolvedValue(
        usuarioDto({ id: 'u-2', isActive: false }),
      );

      await service.desactivar('u-2', actor('admin-1'), contexto);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { usuarioId: 'u-2', revoked: false },
        data: { revoked: true, revokedAt: expect.any(Date) as Date },
      });
      expect(userCache.invalidate).toHaveBeenCalledWith('u-2');
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'USER_DEACTIVATED' }),
      );
    });
  });

  describe('editar', () => {
    it('nunca acepta cambiar rol ni puesto aunque llegaran en el objeto de entrada', async () => {
      usuariosRepository.editar.mockResolvedValue(usuarioDto({ id: 'u-2' }));

      const datosConCamposExtra = {
        nombreCompleto: 'Nuevo nombre',
        telefono: '87654321',
        dpi: '9876543210123',
        username: 'jperez2',
        rol: 'ADMINISTRACION',
        puesto: 'DOCTORA',
      } as never;

      await service.editar('u-2', datosConCamposExtra, contexto);

      expect(usuariosRepository.editar).toHaveBeenCalledWith({
        id: 'u-2',
        nombreCompleto: 'Nuevo nombre',
        telefono: '87654321',
        dpi: '9876543210123',
        username: 'jperez2',
      });
    });
  });

  describe('ficha de personal', () => {
    const FICHA_ID = '11111111-1111-4111-8111-111111111111';
    const nuevaCuenta = (parcial = {}) => ({
      nombreCompleto: 'X',
      telefono: '12345678',
      dpi: '1234567890123',
      username: 'nueva',
      rol: 'JURIDICO' as const,
      puesto: 'ABOGADA',
      ...parcial,
    });
    const ficha = (parcial = {}) => ({
      id: FICHA_ID,
      area: 'JURIDICO' as const,
      tipo: 'ABOGADA',
      usuarioId: null,
      ...parcial,
    });

    beforeEach(() => {
      usuariosRepository.crear.mockResolvedValue(usuarioDto());
    });

    it('una cuenta de Jurídico sin ficha elegida crea su ficha nueva', async () => {
      await service.crear(nuevaCuenta(), contexto);

      expect(usuariosRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fichaPersonal: { modo: 'nueva' } }),
      );
    });

    it('una cuenta de un área sin catálogo de personal no lleva ficha', async () => {
      await service.crear(
        nuevaCuenta({ rol: 'PSICOLOGIA', puesto: 'PSICOLOGA' }),
        contexto,
      );

      expect(usuariosRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({ fichaPersonal: null }),
      );
    });

    it('enlaza la ficha existente elegida si está libre y coincide el puesto', async () => {
      usuariosRepository.buscarFichaPersonal.mockResolvedValue(ficha());

      await service.crear(nuevaCuenta({ personalId: FICHA_ID }), contexto);

      expect(usuariosRepository.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          fichaPersonal: { modo: 'existente', id: FICHA_ID },
        }),
      );
    });

    it.each([
      ['no existe', null, BadRequestException],
      ['es de otra área', ficha({ area: 'PSICOLOGIA' }), BadRequestException],
      [
        'es de otro puesto',
        ficha({ tipo: 'PROCURADORA' }),
        BadRequestException,
      ],
      ['ya es de otra cuenta', ficha({ usuarioId: 'otra' }), ConflictException],
    ])('no crea la cuenta si la ficha %s', async (_caso, encontrada, error) => {
      usuariosRepository.buscarFichaPersonal.mockResolvedValue(encontrada);

      await expect(
        service.crear(nuevaCuenta({ personalId: FICHA_ID }), contexto),
      ).rejects.toBeInstanceOf(error);
      expect(usuariosRepository.crear).not.toHaveBeenCalled();
    });

    it('vincula una cuenta vieja sin puesto a una ficha libre de su área y lo audita con ids', async () => {
      usuariosRepository.buscarPorId.mockResolvedValue(
        usuarioDto({ puesto: null }),
      );
      usuariosRepository.buscarFichaPersonal.mockResolvedValue(
        ficha({ tipo: 'PROCURADORA' }),
      );
      usuariosRepository.vincularFichaPersonal.mockResolvedValue(
        usuarioDto({ personalId: FICHA_ID }),
      );

      await service.vincularFichaPersonal(
        'u-1',
        { personalId: FICHA_ID },
        contexto,
      );

      expect(usuariosRepository.vincularFichaPersonal).toHaveBeenCalledWith(
        'u-1',
        FICHA_ID,
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'USER_PERSONAL_LINKED',
          detalles: { personalAnteriorId: null, personalId: FICHA_ID },
        }),
      );
    });

    it('volver a enviar la ficha que ya tiene la cuenta no es un conflicto', async () => {
      usuariosRepository.buscarPorId.mockResolvedValue(
        usuarioDto({ personalId: FICHA_ID }),
      );
      usuariosRepository.buscarFichaPersonal.mockResolvedValue(
        ficha({ usuarioId: 'u-1' }),
      );
      usuariosRepository.vincularFichaPersonal.mockResolvedValue(
        usuarioDto({ personalId: FICHA_ID }),
      );

      await expect(
        service.vincularFichaPersonal(
          'u-1',
          { personalId: FICHA_ID },
          contexto,
        ),
      ).resolves.toBeDefined();
    });

    it('no vincula una cuenta de un área sin fichas de personal', async () => {
      usuariosRepository.buscarPorId.mockResolvedValue(
        usuarioDto({ rol: 'TRABAJO_SOCIAL', puesto: 'TRABAJADORA_SOCIAL' }),
      );

      await expect(
        service.vincularFichaPersonal('u-1', { personalId: null }, contexto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usuariosRepository.vincularFichaPersonal).not.toHaveBeenCalled();
    });
  });
});
