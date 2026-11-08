import { useOutletContext } from 'react-router-dom'
import type { ExpedienteDetalleArea, FichaUsuariaPsicologiaDto, PersonaParaAbrirDto } from '@akyuam/shared'

/**
 * Quienes pueden empezar un proceso desde la ficha: la usuaria y cada hijo/a sin proceso abierto en
 * un expediente que el área ya tomó. `numero` es el código que tendrá su proceso.
 */
export function personasPorAbrir(ficha: FichaUsuariaPsicologiaDto): PersonaParaAbrirDto[] {
  const { usuaria } = ficha
  return [
    ...(ficha.puedeAbrirProceso
      ? [
          {
            ninoId: null,
            nombreCompleto: usuaria.nombreCompleto,
            edad: usuaria.edad,
            numero: ficha.codigoProcesoNuevo,
            atendidaPor: null,
          },
        ]
      : []),
    ...ficha.hijos
      .filter((hijo) => hijo.puedeAbrirProceso)
      .map((hijo) => ({
        ninoId: hijo.ninoId,
        nombreCompleto: hijo.nombreCompleto,
        edad: hijo.edad,
        numero: hijo.codigoProcesoNuevo,
        atendidaPor: null,
      })),
  ]
}

/** Lo que `FichaUsuaria` comparte con sus pestañas. */
export interface ContextoFicha {
  ficha: FichaUsuariaPsicologiaDto
  /**
   * Datos y documentos de Trabajo Social del expediente actual. `null` mientras cargan; si fallan,
   * `errorExpedienteTs` lo explica y las pestañas que los usan muestran el error.
   */
  expedienteTs: ExpedienteDetalleArea | null
  errorExpedienteTs: string | null
  /**
   * Abre el modal de la primera cita con esa persona ya marcada (null = la usuaria); ahí se pueden
   * marcar más. Quien la agenda queda como responsable.
   */
  abrirProceso: (ninoId: string | null) => void
  /** Proceso recién abierto: su enlace toma el foco para seguir desde ahí. */
  procesoRecienAbierto: string | null
}

export function useContextoFicha() {
  return useOutletContext<ContextoFicha>()
}
