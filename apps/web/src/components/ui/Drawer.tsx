import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useDialogoModal } from './useDialogoModal'

interface DrawerProps {
  abierto: boolean
  titulo: string
  /** Meta bajo el título; con ella el encabezado usa el tamaño de título de ficha (plan §12.8). */
  subtitulo?: string
  onCerrar: () => void
  children: ReactNode
  /** Acciones fijas al fondo del panel, fuera del área con scroll. */
  pie?: ReactNode
}

/**
 * Panel lateral para consultas largas o formularios que no deben bloquear la pantalla como
 * un modal — ver planjuridico.md, punto 13 ("modal como último recurso"). Se monta vía portal
 * para escapar cualquier contenedor con `overflow` de un ancestro.
 */
export default function Drawer({ abierto, titulo, subtitulo, onCerrar, children, pie }: DrawerProps) {
  const panel = useDialogoModal<HTMLDivElement>(abierto, onCerrar)

  if (!abierto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden="true" className="absolute inset-0 bg-black/30" onClick={onCerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-drawer"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="titulo-drawer" className={subtitulo ? 'text-[17px] font-semibold text-gray-900' : 'text-sm font-semibold text-gray-800'}>
              {titulo}
            </h2>
            {subtitulo && <p className="mt-0.5 text-xs text-gray-500 tabular-nums">{subtitulo}</p>}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/50 px-5 py-3.5">{pie}</div>}
      </div>
    </div>,
    document.body,
  )
}
