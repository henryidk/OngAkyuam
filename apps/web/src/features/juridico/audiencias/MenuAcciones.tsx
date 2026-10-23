import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'

export interface OpcionMenu {
  clave: string
  etiqueta: string
  Icono?: LucideIcon
  /** Segunda línea en gris que explica qué pasa al elegirla. */
  detalle?: string
  /** `aviso`: ámbar, para lo que cambia el estado del caso de forma delicada (abandono). */
  tono?: 'aviso'
  onElegir: () => void
}

const SEPARACION_PX = 4
/** Alto aproximado de cada opción y del relleno del menú, para decidir si abre hacia arriba. */
const ALTO_OPCION_PX = 36
const ALTO_OPCION_CON_DETALLE_PX = 54
const RELLENO_MENU_PX = 8

interface Posicion {
  top?: number
  bottom?: number
  right: number
}

const CLASES_BOTON = {
  fila: 'rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800',
  borde:
    'flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 aria-expanded:bg-gray-50',
}

/**
 * Menú "⋯" de una fila o de una cabecera. Va en un portal con posición fija porque la tabla recorta lo que se sale
 * de su scroll horizontal. Se cierra con Esc, al elegir, al tocar fuera o al desplazar la página,
 * y Esc devuelve el foco al botón.
 */
export default function MenuAcciones({
  opciones,
  etiqueta,
  boton: estiloBoton = 'fila',
}: {
  opciones: OpcionMenu[]
  etiqueta: string
  /** `fila`: discreto, dentro de una tabla. `borde`: junto a los botones de una cabecera. */
  boton?: keyof typeof CLASES_BOTON
}) {
  const [posicion, setPosicion] = useState<Posicion | null>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const idMenu = useId()
  const abierto = posicion !== null

  function alternar() {
    const rect = boton.current?.getBoundingClientRect()
    if (abierto || !rect) return setPosicion(null)
    const right = window.innerWidth - rect.right
    const alto =
      opciones.reduce((total, opcion) => total + (opcion.detalle ? ALTO_OPCION_CON_DETALLE_PX : ALTO_OPCION_PX), 0) +
      RELLENO_MENU_PX
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
        className={CLASES_BOTON[estiloBoton]}
      >
        <MoreHorizontal size={estiloBoton === 'borde' ? 18 : 16} aria-hidden="true" />
      </button>
      {posicion &&
        createPortal(
          <div
            ref={menu}
            id={idMenu}
            role="menu"
            style={posicion}
            className={`fixed z-40 rounded-lg border border-gray-200 bg-white shadow-lg ${
              opciones.some((opcion) => opcion.detalle) ? 'w-[280px] max-w-[calc(100vw-32px)] p-1.5' : 'min-w-[220px] py-1'
            }`}
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
                className={`flex w-full items-center gap-2 px-3 text-left text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                  opcion.detalle ? 'rounded-md py-2' : 'py-2'
                } ${opcion.tono === 'aviso' ? 'text-[#8a5a14]' : 'text-gray-700'}`}
              >
                {opcion.Icono && <opcion.Icono size={15} aria-hidden="true" className="shrink-0 text-gray-500" />}
                {opcion.detalle ? (
                  <span className="min-w-0">
                    <span className="block font-medium">{opcion.etiqueta}</span>
                    <span className="block text-xs text-gray-500">{opcion.detalle}</span>
                  </span>
                ) : (
                  opcion.etiqueta
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
