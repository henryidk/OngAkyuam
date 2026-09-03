import { HttpException, HttpStatus } from '@nestjs/common';

export class LoginBloqueadoException extends HttpException {
  constructor(segundosRestantes: number) {
    super(
      `Demasiados intentos fallidos. Intente de nuevo en ${segundosRestantes} segundos.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
