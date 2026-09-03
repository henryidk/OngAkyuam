import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { EnvVars } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { COOKIE_NAMES } from '../constants/auth.constants';
import type {
  AuthenticatedUser,
  JwtAccessPayload,
} from '../interfaces/jwt-payload.interface';
import { UserCacheService } from '../services/user-cache.service';
import { USUARIO_PUBLICO_SELECT } from '../types/usuario-publico.type';

function cookieExtractor(req: Request): string | null {
  return (
    (req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] as string | undefined) ?? null
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<EnvVars, true>,
    private readonly prisma: PrismaService,
    private readonly userCache: UserCacheService,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    const cached = await this.userCache.get(payload.sub);
    if (cached) {
      return cached;
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
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
