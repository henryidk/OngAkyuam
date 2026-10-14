import { Injectable } from '@nestjs/common';

/**
 * La hora actual, inyectada: los estados derivados de una cita (en curso, sin registrar) y las
 * horas libres dependen del reloj, y las pruebas necesitan fijarlo.
 */
export interface IReloj {
  ahora(): Date;
}

export const RELOJ = Symbol('RELOJ_MEDICA');

@Injectable()
export class RelojSistema implements IReloj {
  ahora(): Date {
    return new Date();
  }
}
