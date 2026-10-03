import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'

/** Recibe la navegación pendiente y decide cuándo ejecutarla (p. ej. tras confirmar que se descartan cambios). */
type GuardiaSalida = (continuar: () => void) => void

// La app usa `BrowserRouter` (sin data router), así que no existe `useBlocker`: la pantalla con
// cambios sin guardar registra aquí su guardia y los enlaces de navegación la consultan.
let guardiaActiva: GuardiaSalida | null = null

/** Devuelve la función que la retira; pensado para el `return` de un `useEffect`. */
export function registrarGuardiaSalida(guardia: GuardiaSalida): () => void {
  guardiaActiva = guardia
  return () => {
    if (guardiaActiva === guardia) guardiaActiva = null
  }
}

/** `true` si alguna pantalla tiene cambios sin guardar (su guardia ya pide confirmación). */
export function hayGuardiaSalida(): boolean {
  return guardiaActiva !== null
}

/** Sin guardia registrada, continúa de inmediato. */
export function pedirConfirmacionSalida(continuar: () => void): void {
  if (guardiaActiva) guardiaActiva(continuar)
  else continuar()
}

/** `onClick` para `Link`/`NavLink`: si hay cambios sin guardar, la navegación espera la confirmación. */
export function useEnlaceProtegido() {
  const navigate = useNavigate()
  return (evento: MouseEvent<HTMLAnchorElement>, destino: string) => {
    const abreEnOtraPestana = evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey
    if (!guardiaActiva || abreEnOtraPestana) return
    evento.preventDefault()
    guardiaActiva(() => navigate(destino))
  }
}
