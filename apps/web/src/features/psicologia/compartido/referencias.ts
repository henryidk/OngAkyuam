import type { ReferenciaHistorialPsicologiaDto } from '@akyuam/shared'

/** De varias referencias pendientes manda la que nadie ha tomado: es la que pide actuar primero. */
export function referenciaPendiente(
  referencias: ReferenciaHistorialPsicologiaDto[],
): ReferenciaHistorialPsicologiaDto | undefined {
  return (
    referencias.find((referencia) => referencia.estado === 'SIN_TOMAR') ??
    referencias.find((referencia) => referencia.estado === 'POR_AGENDAR')
  )
}
