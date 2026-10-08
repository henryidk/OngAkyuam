import { useOutletContext } from 'react-router-dom'
import type { ProcesoPsicologiaDetalle, SesionProcesoDto } from '@akyuam/shared'

/** Las sesiones del proceso, que se piden una vez y comparten las dos pestañas. */
export interface SesionesDelProceso {
  /** null mientras llega la primera página. */
  items: SesionProcesoDto[] | null
  error: string | null
  hayMas: boolean
  cargandoMas: boolean
  errorMas: string | null
  cargarMas: () => void
  recargar: () => void
}

/** Lo que `DetalleProceso` comparte con sus pestañas (Sesiones y Documentos). */
export interface ContextoDetalle {
  proceso: ProcesoPsicologiaDetalle
  sesiones: SesionesDelProceso
}

export function useContextoDetalle() {
  return useOutletContext<ContextoDetalle>()
}

/** Props comunes de los modales de acción sobre un proceso. */
export interface PropsModalProceso {
  proceso: ProcesoPsicologiaDetalle
  onCerrar: () => void
  /** La acción se guardó: cerrar, avisar y refrescar. */
  onHecho: (mensaje: string) => void
  /** El servidor respondió 409: refrescar para que el modal lea la versión nueva. */
  onConflicto: () => void
}
