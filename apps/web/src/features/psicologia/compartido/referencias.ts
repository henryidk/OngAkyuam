import type { ReferenciaHistorialPsicologiaDto } from '@akyuam/shared'

/** La referencia que nadie ha tomado todavía: la que pide actuar desde la ficha. */
export function referenciaPendiente(
  referencias: ReferenciaHistorialPsicologiaDto[],
): ReferenciaHistorialPsicologiaDto | undefined {
  return referencias.find((referencia) => referencia.estado === 'SIN_TOMAR')
}
