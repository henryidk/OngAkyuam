import { useOutletContext } from 'react-router-dom'
import type { ExpedienteDetalleArea, FichaUsuariaJuridicoDto } from '@akyuam/shared'

/** Lo que `FichaUsuaria` comparte con sus pestañas. */
export interface ContextoFicha {
  ficha: FichaUsuariaJuridicoDto
  /**
   * Datos y documentos de Trabajo Social del expediente actual. `null` mientras cargan; si fallan,
   * `errorExpedienteTs` lo explica y las pestañas que los usan muestran el error.
   */
  expedienteTs: ExpedienteDetalleArea | null
  errorExpedienteTs: string | null
  recargar: () => void
}

export function useContextoFicha() {
  return useOutletContext<ContextoFicha>()
}
