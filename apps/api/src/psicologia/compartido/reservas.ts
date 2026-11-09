import { Injectable } from '@nestjs/common';
import { ReservasCasoArea } from '../../common/reservas-caso';

@Injectable()
export class ReservasPsicologia extends ReservasCasoArea {
  protected readonly ambito = 'psicologia';
  protected readonly area = 'PSICOLOGIA' as const;
}
