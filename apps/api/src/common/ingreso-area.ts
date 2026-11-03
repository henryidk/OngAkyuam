import type { Prisma } from '@prisma/client';
import type { TipoIngresoArea } from '@akyuam/shared';

/**
 * Lo que se pide de una referencia para saber el ingreso de la usuaria al área. La fila la
 * escribe la base al crearse la referencia (migración `ingreso_area`), así que siempre existe.
 */
export const SELECT_INGRESO_USUARIA = {
  ingresos: { where: { hijoId: null }, select: { ingreso: true }, take: 1 },
} as const satisfies Prisma.ReferidoAreaSelect;

export function ingresoDeUsuaria(referencia: {
  id: string;
  ingresos: { ingreso: TipoIngresoArea }[];
}): TipoIngresoArea {
  const fila = referencia.ingresos[0];
  if (!fila) {
    // La base lo garantiza con un trigger: si falta, es un error de datos que debe verse.
    throw new Error(`La referencia ${referencia.id} no tiene ingreso por área`);
  }
  return fila.ingreso;
}
