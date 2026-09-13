import { Injectable, UnauthorizedException } from '@nestjs/common';
import { parse } from 'cookie';
import type { Socket } from 'socket.io';
import { COOKIE_NAMES } from '../constants/auth.constants';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { AuthenticatedUserResolver } from './authenticated-user.resolver';
import { TokenService } from './token.service';

// El handshake de Socket.IO no pasa por el middleware cookie-parser de Express (ese
// solo corre en el pipeline HTTP), así que la cookie accessToken se parsea a mano acá
// a partir del header Cookie crudo del handshake.
@Injectable()
export class SocketAuthService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly authenticatedUserResolver: AuthenticatedUserResolver,
  ) {}

  async autenticar(client: Socket): Promise<AuthenticatedUser> {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      throw new UnauthorizedException();
    }

    const accessToken = parse(cookieHeader)[COOKIE_NAMES.ACCESS_TOKEN];
    if (!accessToken) {
      throw new UnauthorizedException();
    }

    const payload = this.tokenService.verifyAccessToken(accessToken);
    return this.authenticatedUserResolver.resolver(payload.sub);
  }
}
