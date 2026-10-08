import { useOutletContext } from 'react-router-dom'
import type { ResumenProcesosPsicologia } from '@akyuam/shared'

/** Lo que `PsicologiaLayout` carga una sola vez y comparte con sus pantallas. */
export interface ContextoPsicologia {
  resumen: ResumenProcesosPsicologia | null
  /** Tras cualquier acción que mueva los totales del menú (tomar un caso, agendar…). */
  recargarResumen: () => void
  /**
   * Sube cada vez que el socket avisa que cambió la lista de referencias sin tomar (Trabajo
   * Social refirió una usuaria u otra psicóloga tomó un caso).
   */
  versionNovedades: number
}

export function useContextoPsicologia() {
  return useOutletContext<ContextoPsicologia>()
}
