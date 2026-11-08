import { Injectable } from '@nestjs/common';
import { IdempotenciaPorUsuario } from '../../common/idempotencia';

@Injectable()
export class IdempotenciaPsicologia extends IdempotenciaPorUsuario {
  protected readonly ambito = 'psicologia';
}
