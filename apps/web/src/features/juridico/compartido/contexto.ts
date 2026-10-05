import { useOutletContext } from 'react-router-dom'
import type { ResumenProcesos } from '@akyuam/shared'

/** Lo que `JuridicoLayout` carga una sola vez y comparte con sus pantallas. */
export interface ContextoJuridico {
  resumen: ResumenProcesos | null
  /** Tras cualquier acción que mueva los totales (crear, finalizar, devolver…). */
  recargarResumen: () => void
  /**
   * Sube cada vez que el socket avisa que Trabajo Social cambió algo que Jurídico ve (referencia,
   * datos o documentos): las pantallas que lo muestran lo usan para volver a pedirse.
   */
  versionNovedades: number
}

export function useContextoJuridico() {
  return useOutletContext<ContextoJuridico>()
}
