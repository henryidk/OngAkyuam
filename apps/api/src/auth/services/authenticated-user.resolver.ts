import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { USUARIO_PUBLICO_SELECT } from '../types/usuario-publico.type';
import { UserCacheService } from './user-cache.service';

// Única fuente de verdad para "cómo se resuelve un usuario autenticado a partir de un
// sub de JWT ya validado" (cache -> DB -> chequeo isActive) — usada tanto por JwtStrategy
// (HTTP) como por SocketAuthService (WebSocket) para que ambas vías de autenticación
// apliquen exactamente la misma regla de autorización.
@Injectable()
export class AuthenticatedUserResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userCache: UserCacheService,
  ) {}

  async resolver(usuarioId: string): Promise<AuthenticatedUser> {
    const cached = await this.userCache.get(usuarioId);
    if (cached) {
      return cached;
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: USUARIO_PUBLICO_SELECT,
    });

    if (!usuario || !usuario.isActive) {
      throw new UnauthorizedException();
    }

    const authenticatedUser: AuthenticatedUser = {
      id: usuario.id,
      username: usuario.username,
      nombreCompleto: usuario.nombreCompleto,
      rol: usuario.rol,
      mustChangePassword: usuario.mustChangePassword,
    };

    await this.userCache.set(usuario.id, authenticatedUser);

    return authenticatedUser;
  }
}
