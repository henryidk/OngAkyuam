import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Error desconocido',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const respuesta =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof respuesta === 'string'
        ? respuesta
        : respuesta && typeof respuesta === 'object' && 'message' in respuesta
          ? respuesta.message
          : 'Error interno del servidor';

    // `codigo` y `detalle` son opcionales: los usa un error que el frontend debe distinguir
    // de otros con el mismo estado HTTP (p. ej. un 409 que pide confirmación).
    const extras: Record<string, unknown> = {};
    if (respuesta && typeof respuesta === 'object') {
      const cuerpo = respuesta as Record<string, unknown>;
      if (typeof cuerpo.codigo === 'string') {
        extras.codigo = cuerpo.codigo;
      }
      if (cuerpo.detalle && typeof cuerpo.detalle === 'object') {
        extras.detalle = cuerpo.detalle;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...extras,
      timestamp: new Date().toISOString(),
    });
  }
}
