import { useEffect, useRef } from 'react'

/**
 * Marca que una pantalla pone en el botón que responde a un atajo (`data-atajo="nuevo"`). Así
 * cada pantalla decide qué es "nuevo" o "anterior" para ella, sin que el atajo sepa de áreas.
 */
export type MarcaAtajo = 'nuevo' | 'anterior' | 'siguiente'

/** Los atajos de uso diario, en el orden en que los lista la ayuda "?". */
export const ATAJOS: readonly { teclas: readonly string[]; accion: string }[] = [
  { teclas: ['N'], accion: 'Nueva cita o consulta (el botón principal de la pantalla)' },
  { teclas: ['←', '→'], accion: 'Semana anterior o siguiente en la Agenda' },
  { teclas: ['/'], accion: 'Ir al buscador de la lista' },
  { teclas: ['?'], accion: 'Ver estos atajos' },
]

const TECLA_A_MARCA: Record<string, MarcaAtajo> = {
  n: 'nuevo',
  N: 'nuevo',
  ArrowLeft: 'anterior',
  ArrowRight: 'siguiente',
}

// Controles donde las flechas ya tienen un uso propio (moverse entre pestañas, opciones, menús).
const CON_FLECHAS_PROPIAS = '[role="tablist"], [role="radiogroup"], [role="menu"], [role="listbox"], [role="slider"]'

function esVisible(elemento: HTMLElement): boolean {
  return elemento.getClientRects().length > 0
}

function escribiendo(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) return false
  return objetivo.isContentEditable || objetivo.closest('input, textarea, select') !== null
}

/** El primer elemento visible y habilitado que cumple el selector. */
function primeroUsable(selector: string): HTMLElement | null {
  const candidatos = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return candidatos.find((uno) => esVisible(uno) && !uno.matches(':disabled, [aria-disabled="true"]')) ?? null
}

/**
 * Atajos de teclado para el uso diario (plan V5.3): `N`, `←`/`→`, `/` y `?`. Nunca actúan
 * mientras se escribe, con Ctrl/Alt/⌘, ni con un modal abierto: una tecla suelta no debe
 * cambiar nada que la persona no esté viendo.
 */
export function useAtajosTeclado(onAyuda: () => void) {
  const ayuda = useRef(onAyuda)
  useEffect(() => {
    ayuda.current = onAyuda
  }, [onAyuda])

  useEffect(() => {
    function onKeyDown(evento: KeyboardEvent) {
      if (evento.defaultPrevented || evento.repeat || evento.ctrlKey || evento.metaKey || evento.altKey) return
      if (escribiendo(evento.target)) return
      if (document.querySelector('[aria-modal="true"]')) return

      if (evento.key === '?') {
        evento.preventDefault()
        ayuda.current()
        return
      }
      if (evento.key === '/') {
        const buscador = primeroUsable('main input[type="search"]')
        if (!buscador) return
        // Sin esto, la "/" se escribiría dentro del buscador recién enfocado.
        evento.preventDefault()
        buscador.focus()
        return
      }

      const marca = TECLA_A_MARCA[evento.key]
      if (!marca) return
      if (marca !== 'nuevo' && evento.target instanceof HTMLElement && evento.target.closest(CON_FLECHAS_PROPIAS)) return
      if (evento.shiftKey && marca === 'nuevo') return
      const boton = primeroUsable(`[data-atajo="${marca}"]`)
      if (!boton) return
      evento.preventDefault()
      boton.click()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}
