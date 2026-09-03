import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUDIT_ACTIONS,
  BCRYPT_ROUNDS,
  REFRESH_TOKEN_TTL_MS,
} from './constants/auth.constants';
import type { CambiarPasswordDto } from './dto/cambiar-password.dto';
import type { LoginDto } from './dto/login.dto';
import { LoginBloqueadoException } from './exceptions/login-bloqueado.exception';
import type { JwtRefreshPayload } from './interfaces/jwt-payload.interface';
import { AuditService } from './services/audit.service';
import { LockoutService } from './services/lockout.service';
import { TokenService } from './services/token.service';
import { UserCacheService } from './services/user-cache.service';
import {
  toUsuarioPublico,
  type UsuarioPublico,
} from './types/usuario-publico.type';

const MENSAJE_CREDENCIALES_INVALIDAS = 'Credenciales incorrectas';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface LoginResult {
  usuario: UsuarioPublico;
  accessToken: string;
  refreshToken: string;
}

interface RefreshResult {
  usuario: UsuarioPublico;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userCache: UserCacheService,
    private readonly tokenService: TokenService,
    private readonly lockoutService: LockoutService,
    private readonly auditService: AuditService,
  ) {}

  // Único lugar que decide qué campos van al audit log de un intento fallido.
  // "contarParaBloqueo" queda aparte porque un usuario inactivo no debe sumar
  // al contador de lockout (no es un intento real de adivinar la contraseña).
  private async registrarIntentoFallido(params: {
    username: string;
    usuarioId?: string;
    razon: string;
    meta: RequestMeta;
    contarParaBloqueo?: boolean;
  }): Promise<void> {
    if (params.contarParaBloqueo) {
      await this.lockoutService.registerFailure(params.username);
    }
    await this.auditService.registrar({
      usuarioId: params.usuarioId,
      username: params.username,
      accion: AUDIT_ACTIONS.LOGIN_FAILED,
      ipAddress: params.meta.ipAddress,
      userAgent: params.meta.userAgent,
      detalles: { razon: params.razon },
    });
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    const segundosBloqueo = await this.lockoutService.getSecondsRemaining(
      dto.username,
    );
    if (segundosBloqueo !== null) {
      throw new LoginBloqueadoException(segundosBloqueo);
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { username: dto.username },
    });

    if (!usuario) {
      await this.registrarIntentoFallido({
        username: dto.username,
        razon: 'Usuario no encontrado',
        meta,
        contarParaBloqueo: true,
      });
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    if (!usuario.isActive) {
      await this.registrarIntentoFallido({
        username: usuario.username,
        usuarioId: usuario.id,
        razon: 'Usuario inactivo',
        meta,
      });
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    const passwordValida = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );
    if (!passwordValida) {
      await this.registrarIntentoFallido({
        username: usuario.username,
        usuarioId: usuario.id,
        razon: 'Contraseña incorrecta',
        meta,
        contarParaBloqueo: true,
      });
      throw new UnauthorizedException(MENSAJE_CREDENCIALES_INVALIDAS);
    }

    await this.lockoutService.reset(dto.username);

    const accessToken = this.tokenService.signAccessToken({
      sub: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    });
    const refreshToken = this.tokenService.signRefreshToken({
      sub: usuario.id,
      username: usuario.username,
    });

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.tokenService.hashToken(refreshToken),
        usuarioId: usuario.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    await this.auditService.registrar({
      usuarioId: usuario.id,
      username: usuario.username,
      accion: AUDIT_ACTIONS.LOGIN_SUCCESS,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { usuario: toUsuarioPublico(usuario), accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    let payload: JwtRefreshPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException();
    }

    const tokenHash = this.tokenService.hashToken(refreshToken);
    const registro = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!registro || registro.revoked || registro.usuarioId !== payload.sub) {
      throw new UnauthorizedException();
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });
    if (!usuario || !usuario.isActive) {
      throw new UnauthorizedException();
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    });

    return { usuario: toUsuarioPublico(usuario), accessToken };
  }

  async logout(
    refreshToken: string | undefined,
    meta: RequestMeta,
  ): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const tokenHash = this.tokenService.hashToken(refreshToken);
    const registro = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { usuario: { select: { username: true } } },
    });
    if (!registro || registro.revoked) {
      return;
    }

    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revoked: true, revokedAt: new Date() },
    });

    await this.auditService.registrar({
      usuarioId: registro.usuarioId,
      username: registro.usuario.username,
      accion: AUDIT_ACTIONS.LOGOUT,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async cambiarPassword(
    usuarioId: string,
    dto: CambiarPasswordDto,
  ): Promise<UsuarioPublico> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
    });

    const passwordActualValida = await bcrypt.compare(
      dto.passwordActual,
      usuario.passwordHash,
    );
    if (!passwordActualValida) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    const nuevoHash = await bcrypt.hash(dto.passwordNueva, BCRYPT_ROUNDS);
    const actualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash: nuevoHash, mustChangePassword: false },
    });

    // El cache del usuario en JwtStrategy es cache-first: si no se invalida aquí,
    // mustChangePassword seguiría en true hasta USER_CACHE_TTL_SECONDS (5 min).
    await this.userCache.invalidate(usuarioId);

    await this.auditService.registrar({
      usuarioId: usuario.id,
      username: usuario.username,
      accion: AUDIT_ACTIONS.PASSWORD_CHANGED,
    });

    return toUsuarioPublico(actualizado);
  }
}
