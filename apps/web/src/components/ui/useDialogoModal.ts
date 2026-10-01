import { useEffect, useRef } from 'react'

const SELECTOR_ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Comportamiento de teclado común a modales y drawers: al abrir, el foco entra al panel; Tab y
 * Shift+Tab no salen de él; Esc lo cierra; al cerrar, el foco vuelve a donde estaba. El panel
 * que recibe el `ref` debe llevar `tabIndex={-1}`.
 */
export function useDialogoModal<T extends HTMLElement>(abierto: boolean, onCerrar: () => void) {
  const panel = useRef<T>(null)
  // `onCerrar` suele ser una función nueva en cada render: se lee por ref para no reiniciar el foco.
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  }, [onCerrar])

  useEffect(() => {
    if (!abierto) return
    const elementoPrevio = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.focus()

    function onKeyDown(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        cerrar.current()
        return
      }
      if (evento.key !== 'Tab' || !panel.current) return

      const enfocables = Array.from(panel.current.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES))
      if (enfocables.length === 0) {
        evento.preventDefault()
        return
      }
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      const activo = document.activeElement
      const fueraDelPanel = !panel.current.contains(activo) || activo === panel.current

      if (evento.shiftKey && (activo === primero || fueraDelPanel)) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && (activo === ultimo || fueraDelPanel)) {
        evento.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      elementoPrevio?.focus()
    }
  }, [abierto])

  return panel
}
