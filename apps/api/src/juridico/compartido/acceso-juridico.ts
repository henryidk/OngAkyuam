import type { Prisma } from '@prisma/client';

/**
 * La regla de acceso de todo el módulo, en un solo lugar: Jurídico solo toca expedientes que
 * Trabajo Social le refirió. Cada consulta de los repositorios la incluye en su `where`, de
 * modo que un id ajeno devuelve "no encontrado" igual que uno inexistente.
 */
export const EXPEDIENTE_REFERIDO_A_JURIDICO = {
  referidos: { some: { area: 'JURIDICO' } },
} satisfies Prisma.ExpedienteWhereInput;

export const PROCESO_CON_ACCESO = {
  expediente: EXPEDIENTE_REFERIDO_A_JURIDICO,
} satisfies Prisma.ProcesoJuridicoWhereInput;

/** Referencia que Jurídico todavía no atendió ni devolvió. */
export const REFERENCIA_PENDIENTE = {
  area: 'JURIDICO',
  atendidoEn: null,
  devueltoEn: null,
} satisfies Prisma.ReferidoAreaWhereInput;

/** "" (sin seleccionar todavía) -> null para la base de datos. */
export function vacioANulo(valor: string): string | null {
  return valor === '' ? null : valor;
}
