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

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
