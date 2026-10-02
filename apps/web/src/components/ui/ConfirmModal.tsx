import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button'
import { useDialogoModal } from './useDialogoModal'

interface ConfirmModalProps {
  abierto: boolean
  titulo: string
  descripcion?: string
  confirmarLabel?: string
  cancelarLabel?: string
  /** Bloquea la confirmación mientras falte una condición (p. ej. una verificación en curso). */
  confirmarDeshabilitado?: boolean
  cargando?: boolean
  error?: string | null
  peligro?: boolean
  onConfirmar: () => void
  onCancelar: () => void
  children?: ReactNode
}

/**
 * Modal corto y puntual — reservado para confirmaciones irreversibles o casi (cerrar un
 * proceso, registrar un abandono), donde interrumpir es intencional. Ver planjuridico.md,
 * punto 13: "modal como último recurso, no como primera opción".
 */
export default function ConfirmModal({
  abierto,
  titulo,
  descripcion,
  confirmarLabel = 'Confirmar',
  cancelarLabel = 'Cancelar',
  confirmarDeshabilitado = false,
  cargando = false,
  error,
  peligro = false,
  onConfirmar,
  onCancelar,
  children,
}: ConfirmModalProps) {
  // Mientras se guarda no se puede cancelar: ni con Esc ni tocando fuera.
  const cancelar = () => {
    if (!cargando) onCancelar()
  }
  const panel = useDialogoModal<HTMLDivElement>(abierto, cancelar)

  if (!abierto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/30" onClick={cancelar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-confirm-modal"
        tabIndex={-1}
        className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl outline-none"
      >
        <h2 id="titulo-confirm-modal" className="text-sm font-semibold text-gray-800">{titulo}</h2>
        {descripcion && <p className="mt-1 text-xs text-gray-500">{descripcion}</p>}

        {children && <div className="mt-4 space-y-3">{children}</div>}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variante="secondary" onClick={onCancelar} disabled={cargando}>
            {cancelarLabel}
          </Button>
          <Button
            type="button"
            variante={peligro ? 'danger' : 'primary'}
            onClick={onConfirmar}
            disabled={confirmarDeshabilitado}
            cargando={cargando}
          >
            {confirmarLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
