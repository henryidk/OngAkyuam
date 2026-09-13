import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import type { EnvVars } from '../../config/env.schema';
import { COOKIE_NAMES } from '../constants/auth.constants';
import type {
  AuthenticatedUser,
  JwtAccessPayload,
} from '../interfaces/jwt-payload.interface';
import { AuthenticatedUserResolver } from '../services/authenticated-user.resolver';

function cookieExtractor(req: Request): string | null {
  return (
    (req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] as string | undefined) ?? null
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<EnvVars, true>,
    private readonly authenticatedUserResolver: AuthenticatedUserResolver,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    return this.authenticatedUserResolver.resolver(payload.sub);
  }
}
