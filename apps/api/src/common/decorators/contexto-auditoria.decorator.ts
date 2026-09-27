import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import type { ContextoAuditoria as IContextoAuditoria } from '../types/contexto-auditoria';

/** Arma el `ContextoAuditoria` a partir del usuario autenticado y la request — evita repetir `{ usuarioId, username, ipAddress, userAgent }` en cada controller. */
export const ContextoAuditoria = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IContextoAuditoria => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    return {
      usuarioId: request.user.id,
      username: request.user.username,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    };
  },
);
