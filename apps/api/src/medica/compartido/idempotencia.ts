import { Injectable } from '@nestjs/common';
import { IdempotenciaPorUsuario } from '../../common/idempotencia';

@Injectable()
export class IdempotenciaMedica extends IdempotenciaPorUsuario {
  protected readonly ambito = 'medica';
}
