import { useOutletContext } from 'react-router-dom'
import type { ContadoresMedicaDto } from '@akyuam/shared'

/** Lo que `MedicaLayout` carga una sola vez y comparte con sus pantallas. */
export interface ContextoMedica {
  contadores: ContadoresMedicaDto | null
  /** Tras cualquier acción que mueva los totales del menú (agendar, registrar, dar de alta…). */
  recargarContadores: () => void
  /** Sube cada vez que el socket avisa de un cambio (p. ej. Trabajo Social refirió a alguien). */
  versionNovedades: number
}

export function useContextoMedica() {
  return useOutletContext<ContextoMedica>()
}
