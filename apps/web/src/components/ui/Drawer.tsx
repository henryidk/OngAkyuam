import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface DrawerProps {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

/**
 * Panel lateral para consultas largas o formularios que no deben bloquear la pantalla como
 * un modal — ver planjuridico.md, punto 13 ("modal como último recurso"). Se monta vía portal
 * para escapar cualquier contenedor con `overflow` de un ancestro.
 */
export default function Drawer({ abierto, titulo, onCerrar, children }: DrawerProps) {
  useEffect(() => {
    if (!abierto) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/30"
        onClick={onCerrar}
      />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
          <button
            aria-label="Cerrar"
            onClick={onCerrar}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
