import { Injectable } from '@nestjs/common';
import { ReservasCasoArea } from '../../common/reservas-caso';

@Injectable()
export class ReservasMedica extends ReservasCasoArea {
  protected readonly ambito = 'medica';
  protected readonly area = 'MEDICA' as const;
}
