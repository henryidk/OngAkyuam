/**
 * Siguiente consecutivo dentro de un expediente (proceso, atención, hijo/a): el mayor de los que
 * ya existen más uno, o 1 si no hay ninguno. Es la misma regla al crear el registro y al mostrar
 * de antemano el código que tendrá, para que la vista previa nunca diga otro número.
 */
export function consecutivoSiguiente(existentes: readonly number[]): number {
  return Math.max(0, ...existentes) + 1;
}

/** `consecutivoSiguiente` a partir del `_max` de un `aggregate` de Prisma. */
export function consecutivoTrasMaximo(maximo: number | null): number {
  return consecutivoSiguiente(maximo === null ? [] : [maximo]);
}
