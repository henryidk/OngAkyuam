import axios from 'axios'
import { useOutletContext } from 'react-router-dom'
import type { ProcesoDetalle } from '@akyuam/shared'

/** Lo que `DetalleProceso` comparte con sus pestañas (Bitácora y Documentos). */
export interface ContextoDetalle {
  proceso: ProcesoDetalle
  /** Vuelve a pedir el proceso sin desmontar la pantalla. */
  refrescar: () => void
  abrirActuacion: () => void
}

export function useContextoDetalle() {
  return useOutletContext<ContextoDetalle>()
}

/** 409: otra persona cambió el proceso (versión vieja) o la acción ya no está disponible. */
export function esConflicto(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 409
}

/** Props comunes de los modales de acción sobre un proceso. */
export interface PropsModalProceso {
  proceso: ProcesoDetalle
  onCerrar: () => void
  /** La acción se guardó: cerrar, avisar y refrescar. */
  onHecho: (mensaje: string) => void
  /** El servidor respondió 409: refrescar para que el modal lea la versión nueva. */
  onConflicto: () => void
}
