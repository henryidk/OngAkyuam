import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'

export interface OpcionMenu {
  clave: string
  etiqueta: string
  onElegir: () => void
}

const SEPARACION_PX = 4
/** Alto aproximado de cada opción y del relleno del menú, para decidir si abre hacia arriba. */
const ALTO_OPCION_PX = 36
const RELLENO_MENU_PX = 8

interface Posicion {
  top?: number
  bottom?: number
  right: number
}

/**
 * Menú "⋯" de la fila. Va en un portal con posición fija porque la tabla recorta lo que se sale
 * de su scroll horizontal. Se cierra con Esc, al elegir, al tocar fuera o al desplazar la página,
 * y Esc devuelve el foco al botón.
 */
export default function MenuAcciones({ opciones, etiqueta }: { opciones: OpcionMenu[]; etiqueta: string }) {
  const [posicion, setPosicion] = useState<Posicion | null>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const idMenu = useId()
  const abierto = posicion !== null

  function alternar() {
    const rect = boton.current?.getBoundingClientRect()
    if (abierto || !rect) return setPosicion(null)
    const right = window.innerWidth - rect.right
    const alto = opciones.length * ALTO_OPCION_PX + RELLENO_MENU_PX
    // En las últimas filas no cabe hacia abajo: se abre hacia arriba del botón.
    const cabeAbajo = rect.bottom + SEPARACION_PX + alto <= window.innerHeight
    setPosicion(
      cabeAbajo
        ? { top: rect.bottom + SEPARACION_PX, right }
        : { bottom: window.innerHeight - rect.top + SEPARACION_PX, right },
    )
  }

  useEffect(() => {
    if (!abierto) return
    menu.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
    const cerrar = () => setPosicion(null)
    function alTocarFuera(evento: MouseEvent) {
      const objetivo = evento.target as Node
      if (!menu.current?.contains(objetivo) && !boton.current?.contains(objetivo)) cerrar()
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      cerrar()
      boton.current?.focus()
    }
    document.addEventListener('mousedown', alTocarFuera)
    document.addEventListener('keydown', alTeclear)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', alTocarFuera)
      document.removeEventListener('keydown', alTeclear)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto])

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? idMenu : undefined}
        onClick={alternar}
        className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {posicion &&
        createPortal(
          <div
            ref={menu}
            id={idMenu}
            role="menu"
            style={posicion}
            className="fixed z-40 min-w-[220px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {opciones.map((opcion) => (
              <button
                key={opcion.clave}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPosicion(null)
                  opcion.onElegir()
                }}
                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
