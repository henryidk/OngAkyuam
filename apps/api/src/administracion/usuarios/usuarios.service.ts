import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  CATALOGOS_TIPO_PERSONAL,
  PUESTOS_POR_AREA,
  type CrearUsuarioInput,
  type CrearUsuarioResultado,
  type EditarUsuarioInput,
  type ListarUsuariosQuery,
  type UsuarioAdminDto,
  type VincularFichaPersonalInput,
} from '@akyuam/shared';
import {
  AUDIT_ACTIONS,
  BCRYPT_ROUNDS,
} from '../../auth/constants/auth.constants';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import { AuditService } from '../../auth/services/audit.service';
import { UserCacheService } from '../../auth/services/user-cache.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { PrismaService } from '../../prisma/prisma.service';
import { USUARIOS_REPOSITORY } from './interfaces/usuarios-repository.interface';
import type {
  CrearUsuarioParams,
  IUsuariosRepository,
} from './interfaces/usuarios-repository.interface';
import { generarPasswordSegura } from './utils/generar-password-segura';

@Injectable()
export class UsuariosService {
  constructor(
    @Inject(USUARIOS_REPOSITORY)
    private readonly usuariosRepository: IUsuariosRepository,
    private readonly auditService: AuditService,
    private readonly userCache: UserCacheService,
    private readonly prisma: PrismaService,
  ) {}

  async listar(query: ListarUsuariosQuery): Promise<UsuarioAdminDto[]> {
    return this.usuariosRepository.listar({ rol: query.rol });
  }

  async crear(
    datos: CrearUsuarioInput,
    contexto: ContextoAuditoria,
  ): Promise<CrearUsuarioResultado> {
    this.validarPuesto(datos.rol, datos.puesto);
    await this.validarUnicidad(datos.username, datos.dpi);
    const fichaPersonal = await this.resolverFichaAlCrear(datos);

    const passwordTemporal = generarPasswordSegura();
    const passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS);

    const usuario = await this.usuariosRepository.crear({
      nombreCompleto: datos.nombreCompleto,
      telefono: datos.telefono,
      dpi: datos.dpi,
      username: datos.username,
      rol: datos.rol,
      puesto: datos.puesto,
      passwordHash,
      fichaPersonal,
    });

    // Nunca la contraseña temporal en `detalles` — solo viaja en la respuesta HTTP.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: AUDIT_ACTIONS.USER_CREATED,
      entidad: 'Usuario',
      entidadId: usuario.id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: { rol: datos.rol, puesto: datos.puesto ?? null },
    });

    return { usuario, passwordTemporal };
  }

  async editar(
    id: string,
    datos: EditarUsuarioInput,
    contexto: ContextoAuditoria,
  ): Promise<UsuarioAdminDto> {
    await this.validarUnicidad(datos.username, datos.dpi, id);

    // `datos` viene tipado por `editarUsuarioSchema`, que no declara `rol`/`puesto` — esta
    // llamada solo puede tocar los 4 campos de abajo aunque el repositorio recibiera más.
    const usuario = await this.usuariosRepository.editar({
      id,
      nombreCompleto: datos.nombreCompleto,
      telefono: datos.telefono,
      dpi: datos.dpi,
      username: datos.username,
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // El username cacheado en Redis (JwtStrategy) quedaría obsoleto si no se invalida aquí.
    await this.userCache.invalidate(id);

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: AUDIT_ACTIONS.USER_UPDATED,
      entidad: 'Usuario',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return usuario;
  }

  async resetearPassword(
    id: string,
    actor: AuthenticatedUser,
    contexto: ContextoAuditoria,
  ): Promise<CrearUsuarioResultado> {
    if (id === actor.id) {
      throw new ConflictException(
        'No puedes resetear tu propia contraseña desde aquí — usa cambiar contraseña',
      );
    }

    const usuario = await this.usuariosRepository.buscarPorId(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const passwordTemporal = generarPasswordSegura();
    const passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS);
    await this.usuariosRepository.actualizarPassword(id, passwordHash);

    await this.revocarSesiones(id);
    await this.userCache.invalidate(id);

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: AUDIT_ACTIONS.PASSWORD_RESET_BY_ADMIN,
      entidad: 'Usuario',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return {
      usuario: { ...usuario, mustChangePassword: true },
      passwordTemporal,
    };
  }

  async desactivar(
    id: string,
    actor: AuthenticatedUser,
    contexto: ContextoAuditoria,
  ): Promise<UsuarioAdminDto> {
    if (id === actor.id) {
      throw new ConflictException('No puedes desactivar tu propia cuenta');
    }

    const usuario = await this.usuariosRepository.setActive(id, false);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.revocarSesiones(id);
    await this.userCache.invalidate(id);

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: AUDIT_ACTIONS.USER_DEACTIVATED,
      entidad: 'Usuario',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return usuario;
  }

  async activar(
    id: string,
    contexto: ContextoAuditoria,
  ): Promise<UsuarioAdminDto> {
    const usuario = await this.usuariosRepository.setActive(id, true);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // No hace falta invalidar cache: una cuenta inactiva no tiene sesión cacheada que
    // reactivar (el login la rechazaba mientras estuvo inactiva).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: AUDIT_ACTIONS.USER_ACTIVATED,
      entidad: 'Usuario',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return usuario;
  }

  async vincularFichaPersonal(
    id: string,
    datos: VincularFichaPersonalInput,
    contexto: ContextoAuditoria,
  ): Promise<UsuarioAdminDto> {
    const usuario = await this.usuariosRepository.buscarPorId(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!usaFichaPersonal(usuario.rol)) {
      throw new BadRequestException('Esta área no tiene fichas de personal');
    }
    if (datos.personalId) {
      await this.validarFichaLibre(datos.personalId, usuario, id);
    }

    const actualizado = await this.usuariosRepository.vincularFichaPersonal(
      id,
      datos.personalId,
    );

    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: AUDIT_ACTIONS.USER_PERSONAL_LINKED,
      entidad: 'Usuario',
      entidadId: id,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
      detalles: {
        personalAnteriorId: usuario.personalId,
        personalId: datos.personalId,
      },
    });

    return actualizado;
  }

  /**
   * Las áreas con catálogo de personal (hoy, Jurídico) necesitan una ficha por cuenta para
   * saber qué procesos son de quién. Si Administración no elige una existente, se crea.
   */
  private async resolverFichaAlCrear(
    datos: CrearUsuarioInput,
  ): Promise<CrearUsuarioParams['fichaPersonal']> {
    if (!usaFichaPersonal(datos.rol)) {
      if (datos.personalId) {
        throw new BadRequestException('Esta área no tiene fichas de personal');
      }
      return null;
    }
    if (!datos.personalId) {
      return { modo: 'nueva' };
    }
    await this.validarFichaLibre(datos.personalId, datos);
    return { modo: 'existente', id: datos.personalId };
  }

  /** La ficha debe ser del área y del puesto de la cuenta, y no estar enlazada a otra. */
  private async validarFichaLibre(
    personalId: string,
    cuenta: { rol: CrearUsuarioInput['rol']; puesto?: string | null },
    usuarioId?: string,
  ): Promise<void> {
    const ficha = await this.usuariosRepository.buscarFichaPersonal(personalId);
    if (!ficha || ficha.area !== cuenta.rol) {
      throw new BadRequestException(
        'Ficha de personal no válida para esta área',
      );
    }
    // Las cuentas viejas pueden no tener puesto: ahí basta con que la ficha sea del área.
    if (cuenta.puesto && ficha.tipo !== cuenta.puesto) {
      throw new BadRequestException(
        'La ficha de personal es de otro puesto que la cuenta',
      );
    }
    if (ficha.usuarioId && ficha.usuarioId !== usuarioId) {
      throw new ConflictException(
        'Esa ficha de personal ya está enlazada a otra cuenta',
      );
    }
  }

  // Defensa en profundidad detrás de `crearUsuarioSchema.superRefine` (Zod) — si el
  // controller cambiara de validador algún día, esta regla de negocio no depende de eso.
  private validarPuesto(rol: CrearUsuarioInput['rol'], puesto?: string): void {
    if (rol === 'ADMINISTRACION') {
      if (puesto) {
        throw new BadRequestException('Administración no tiene puesto');
      }
      return;
    }

    const puestosValidos = PUESTOS_POR_AREA[rol];
    if (!puesto || !puestosValidos.includes(puesto)) {
      throw new BadRequestException('Puesto inválido para esta área');
    }
  }

  private async validarUnicidad(
    username: string,
    dpi: string,
    excluirId?: string,
  ): Promise<void> {
    if (await this.usuariosRepository.existeUsername(username, excluirId)) {
      throw new ConflictException('El nombre de usuario ya está en uso');
    }
    if (await this.usuariosRepository.existeDpi(dpi, excluirId)) {
      throw new ConflictException(
        'El DPI ya está registrado para otro usuario',
      );
    }
  }

  // Sin esto, una sesión ya abierta seguiría funcionando hasta ACCESS_TOKEN_TTL (15 min)
  // más después de resetear/desactivar a alguien.
  private async revocarSesiones(usuarioId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { usuarioId, revoked: false },
      data: { revoked: true, revokedAt: new Date() },
    });
  }
}

function usaFichaPersonal(rol: CrearUsuarioInput['rol']): boolean {
  return rol in CATALOGOS_TIPO_PERSONAL;
}
