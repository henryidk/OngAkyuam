import { useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDialogoModal } from '../ui/useDialogoModal'

interface ModalPasosProps {
  titulo: string
  subtitulo?: string
  /** Ancho máximo en px. */
  ancho?: number
  pie: ReactNode
  children: ReactNode
}

/**
 * Marco de un modal de varios pasos (programar una cita): encabezado, cuerpo con scroll y pie con
 * las acciones, que pone quien lo usa. Solo se sale con el botón Cancelar del pie: ni tocando fuera ni con Esc, para no
 * perder por accidente lo ya elegido.
 */
export default function ModalPasos({ titulo, subtitulo, ancho = 560, pie, children }: ModalPasosProps) {
  const idTitulo = useId()
  // Esc y el fondo no cierran: el único camino es el Cancelar del pie.
  const panel = useDialogoModal<HTMLDivElement>(true, () => undefined)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-gray-900/40" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        style={{ maxWidth: ancho }}
        className="relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl outline-none"
      >
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 id={idTitulo} className="text-[17px] font-semibold text-gray-900">
            {titulo}
          </h2>
          {subtitulo && <p className="mt-0.5 text-[13px] text-gray-500">{subtitulo}</p>}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">{pie}</div>
      </div>
    </div>,
    document.body,
  )
}
