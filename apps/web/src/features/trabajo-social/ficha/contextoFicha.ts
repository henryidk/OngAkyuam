import { useOutletContext, useSearchParams } from 'react-router-dom'
import type { AreaAtencion, UsuariaExpedienteHub } from '@akyuam/shared'

/** Lo que el layout de la ficha comparte con cada pestaña (rutas anidadas, vía `<Outlet context>`). */
export interface ContextoFicha {
  usuaria: UsuariaExpedienteHub
  onUsuariaActualizada: (usuaria: UsuariaExpedienteHub) => void
  /** Abre "Referir" sobre el caso activo; con `area`, ya elegida. */
  abrirReferir: (area?: AreaAtencion) => void
  /** Sube cada vez que algo del caso cambia (p. ej. un referido nuevo) — las pestañas recargan lo suyo. */
  version: number
}

export function useContextoFicha() {
  return useOutletContext<ContextoFicha>()
}

/**
 * Caso elegido en Documentos y Accesos (`?caso=`). Por defecto, el activo; un id que no es de
 * esta usuaria se ignora (el backend igual valida el permiso).
 */
export function useCasoSeleccionado(usuaria: UsuariaExpedienteHub) {
  const [params, setParams] = useSearchParams()
  const pedido = params.get('caso')
  const caso = usuaria.casos.find((c) => c.id === pedido) ?? usuaria.casos[0] ?? null

  function seleccionar(expedienteId: string) {
    setParams(
      (actual) => {
        const siguiente = new URLSearchParams(actual)
        if (expedienteId === usuaria.casos[0]?.id) siguiente.delete('caso')
        else siguiente.set('caso', expedienteId)
        return siguiente
      },
      { replace: true },
    )
  }

  return { caso, seleccionar }
}
