import { useOutletContext } from 'react-router-dom'
import type { ExpedienteDetalleArea, FichaUsuariaPsicologiaDto } from '@akyuam/shared'

/** Lo que `FichaUsuaria` comparte con sus pestañas. */
export interface ContextoFicha {
  ficha: FichaUsuariaPsicologiaDto
  /**
   * Datos y documentos de Trabajo Social del expediente actual. `null` mientras cargan; si fallan,
   * `errorExpedienteTs` lo explica y las pestañas que los usan muestran el error.
   */
  expedienteTs: ExpedienteDetalleArea | null
  errorExpedienteTs: string | null
}

export function useContextoFicha() {
  return useOutletContext<ContextoFicha>()
}
