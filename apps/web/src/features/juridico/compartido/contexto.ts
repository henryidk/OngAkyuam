import { useOutletContext } from 'react-router-dom'
import type { ResumenProcesos } from '@akyuam/shared'

/** Lo que `JuridicoLayout` carga una sola vez y comparte con sus pantallas. */
export interface ContextoJuridico {
  resumen: ResumenProcesos | null
  /** Tras cualquier acción que mueva los totales (crear, finalizar, devolver…). */
  recargarResumen: () => void
}

export function useContextoJuridico() {
  return useOutletContext<ContextoJuridico>()
}
