import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { COOKIE_NAMES } from './constants/auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { SkipMustChangePassword } from './decorators/skip-must-change-password.decorator';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import { CookieService } from './services/cookie.service';

function extraerRefreshTokenCookie(req: Request): string | undefined {
  return req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cookieService: CookieService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { usuario, accessToken, refreshToken } = await this.authService.login(
      dto,
      {
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      },
    );

    this.cookieService.setAuthCookies(res, accessToken, refreshToken);

    return { usuario, mustChangePassword: usuario.mustChangePassword };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = extraerRefreshTokenCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    const { usuario, accessToken } =
      await this.authService.refresh(refreshToken);
    this.cookieService.setAccessCookies(res, accessToken);

    return { usuario };
  }

  // Cerrar sesión debe quedar disponible sin importar mustChangePassword:
  // el usuario tiene que poder abandonar la sesión aunque no haya cambiado
  // la contraseña todavía.
  @SkipMustChangePassword()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const refreshToken = extraerRefreshTokenCookie(req);
    await this.authService.logout(refreshToken, {
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });
    this.cookieService.clearAuthCookies(res);
    return { ok: true };
  }

  // Debe quedar accesible aun con mustChangePassword=true: es la ruta que el
  // frontend usa para rehidratar la sesión (incluido al recargar la página
  // parado en la pantalla obligatoria de cambio de contraseña).
  @SkipMustChangePassword()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @SkipMustChangePassword()
  @Post('cambiar-password')
  @HttpCode(HttpStatus.OK)
  async cambiarPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CambiarPasswordDto,
  ) {
    const usuario = await this.authService.cambiarPassword(user.id, dto);
    return { usuario };
  }
}
