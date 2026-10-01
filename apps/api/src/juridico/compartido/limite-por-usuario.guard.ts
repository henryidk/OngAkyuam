import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Límite de peticiones por persona autenticada, no por IP: detrás del proxy todas las
 * peticiones llegan desde la misma dirección y un límite por IP las mezclaría.
 */
@Injectable()
export class LimitePorUsuarioGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const usuario = req.user as { id?: string } | undefined;
    return Promise.resolve(usuario?.id ?? String(req.ip));
  }

  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      'Demasiadas solicitudes. Espere un momento e intente de nuevo',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
