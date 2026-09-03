import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import type { EnvVars } from '../../config/env.schema';
import {
  ACCESS_TOKEN_TTL_MS,
  COOKIE_NAMES,
  REFRESH_TOKEN_TTL_MS,
} from '../constants/auth.constants';

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService<EnvVars, true>) {}

  private get isProduction(): boolean {
    return this.configService.getOrThrow<string>('NODE_ENV') === 'production';
  }

  /** Setea las 3 cookies de una sesión nueva (login). */
  setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    this.setAccessCookies(res, accessToken);

    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }

  /** Renueva solo accessToken + csrfToken (refresh), sin tocar el refreshToken. */
  setAccessCookies(res: Response, accessToken: string): void {
    const csrfToken = randomBytes(32).toString('hex');

    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_MS,
    });

    res.cookie(COOKIE_NAMES.CSRF_TOKEN, csrfToken, {
      httpOnly: false,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: ACCESS_TOKEN_TTL_MS,
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: '/' });
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/api/auth' });
    res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, { path: '/' });
  }
}
