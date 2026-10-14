import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useDialogoModal } from '../../../components/ui/useDialogoModal'

interface ModalMedicaProps {
  titulo: string
  subtitulo?: string
  /** Ancho máximo en px (560 para programar, 480 para el alta). */
  ancho?: number
  /** Mientras se guarda no se puede cerrar (ni con Esc ni tocando fuera). */
  ocupado?: boolean
  onCerrar: () => void
  pie: ReactNode
  children: ReactNode
}

/** Marco de los modales del módulo: encabezado, cuerpo con scroll y pie gris con las acciones. */
export default function ModalMedica({ titulo, subtitulo, ancho = 560, ocupado = false, onCerrar, pie, children }: ModalMedicaProps) {
  const cerrar = () => {
    if (!ocupado) onCerrar()
  }
  const panel = useDialogoModal<HTMLDivElement>(true, cerrar)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-[#1c2430]/40" onClick={cerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-medica"
        tabIndex={-1}
        style={{ maxWidth: ancho }}
        className="relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e3e6ea] px-5 py-4">
          <div className="min-w-0">
            <h2 id="titulo-modal-medica" className="text-[17px] font-semibold text-[#1c2430]">
              {titulo}
            </h2>
            {subtitulo && <p className="mt-0.5 text-[13px] text-[#5b6573]">{subtitulo}</p>}
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={cerrar}
            disabled={ocupado}
            className="rounded p-1 text-[#5b6573] hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-[#e3e6ea] bg-[#fafbfc] px-5 py-3">{pie}</div>
      </div>
    </div>,
    document.body,
  )
}
