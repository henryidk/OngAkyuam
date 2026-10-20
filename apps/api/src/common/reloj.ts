import { Injectable } from '@nestjs/common';

/**
 * La hora actual, inyectada: los estados que dependen del reloj (una cita en curso, una
 * audiencia pendiente de resultado) y las reglas de "solo a futuro" se prueban fijándolo.
 */
export interface IReloj {
  ahora(): Date;
}

export const RELOJ = Symbol('RELOJ');

@Injectable()
export class RelojSistema implements IReloj {
  ahora(): Date {
    return new Date();
  }
}
