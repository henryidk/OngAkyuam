import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDialogoModal } from '../../../components/ui/useDialogoModal'

interface MarcoModalAudienciaProps {
  titulo: string
  subtitulo: string
  /** Decide si se puede cerrar (p. ej. no mientras sube): Esc y tocar fuera pasan por aquí. */
  onCerrar: () => void
  pie: ReactNode
  children: ReactNode
}

/** Marco de los modales de audiencia con varios momentos (guardar y luego subir), más amplio que `ConfirmModal`. */
export default function MarcoModalAudiencia({ titulo, subtitulo, onCerrar, pie, children }: MarcoModalAudienciaProps) {
  const panel = useDialogoModal<HTMLDivElement>(true, onCerrar)
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10">
      <div aria-hidden="true" className="absolute inset-0 bg-gray-900/50" onClick={onCerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-audiencia"
        tabIndex={-1}
        className="relative w-full max-w-[600px] rounded-xl bg-white shadow-2xl outline-none"
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 id="titulo-modal-audiencia" className="text-lg font-semibold text-gray-900">
            {titulo}
          </h2>
          <p className="mt-0.5 text-[13px] text-gray-500">{subtitulo}</p>
        </div>
        <div className="space-y-4 px-6 py-5">{children}</div>
        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50/50 px-6 py-4">{pie}</div>
      </div>
    </div>,
    document.body,
  )
}
