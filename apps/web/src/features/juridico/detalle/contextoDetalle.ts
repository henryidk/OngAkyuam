import axios from 'axios'
import { useOutletContext } from 'react-router-dom'
import type { ProcesoDetalle } from '@akyuam/shared'
import type { ModalAudiencia } from '../audiencias/caso'

/** Lo que `DetalleProceso` comparte con sus pestañas (Bitácora, Documentos y Audiencias). */
export interface ContextoDetalle {
  proceso: ProcesoDetalle
  /** Vuelve a pedir el proceso sin desmontar la pantalla. */
  refrescar: () => void
  abrirActuacion: () => void
  /** Los modales de audiencia viven en el detalle: la cabecera y la pestaña abren los mismos. */
  abrirAudiencia: (modal: ModalAudiencia) => void
  /** Sube con cada cambio en una audiencia: la pestaña Audiencias vuelve a pedir la lista. */
  versionAudiencias: number
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
