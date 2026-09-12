import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import type { ZodType } from 'zod';

// Valida body/query contra un schema de Zod compartido con el frontend (packages/shared),
// para que un mismo schema sea la única fuente de verdad de validación en ambos lados.
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }

    const resultado = this.schema.safeParse(value);
    if (!resultado.success) {
      const mensaje = resultado.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new BadRequestException(mensaje || 'Datos inválidos');
    }

    return resultado.data;
  }
}
