import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useDialogoModal } from './useDialogoModal'

interface ModalProps {
  abierto: boolean
  titulo: string
  descripcion?: string
  Icono?: LucideIcon
  onCerrar: () => void
  children: ReactNode
  /** Ancho máximo del panel. `lg` (por defecto) alcanza para un formulario a dos columnas. */
  ancho?: 'md' | 'lg' | 'xl'
}

const CLASES_ANCHO = { md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const

/**
 * Modal centrado para formularios cortos y autocontenidos (p. ej. crear o editar una cuenta),
 * donde la persona no necesita ver la pantalla de fondo mientras llena los datos. Para
 * consultas largas que conviven con la lista se sigue usando `Drawer`; para confirmaciones,
 * `ConfirmModal`.
 *
 * Tocar fuera NO lo cierra a propósito: un clic accidental borraría lo ya escrito. Se cierra
 * con Esc, con la X o con el botón Cancelar del propio formulario.
 */
export default function Modal({
  abierto,
  titulo,
  descripcion,
  Icono,
  onCerrar,
  children,
  ancho = 'lg',
}: ModalProps) {
  const panel = useDialogoModal<HTMLDivElement>(abierto, onCerrar)

  if (!abierto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal"
        aria-describedby={descripcion ? 'descripcion-modal' : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl ${CLASES_ANCHO[ancho]}`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-gray-100 px-6 py-4">
          {Icono && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
              <Icono className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="titulo-modal" className="text-base font-semibold text-gray-900">
              {titulo}
            </h2>
            {descripcion && (
              <p id="descripcion-modal" className="mt-0.5 text-sm text-gray-500">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="-mt-1 -mr-2 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* El contenido maneja su propio scroll y pie (ver `PieModal`). */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

/** Cuerpo con scroll del modal. */
export function CuerpoModal({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
}

/** Pie fijo del modal: queda visible aunque el cuerpo haga scroll. */
export function PieModal({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3">
      {children}
    </div>
  )
}
