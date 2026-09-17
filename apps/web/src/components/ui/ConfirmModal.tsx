import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button'

interface ConfirmModalProps {
  abierto: boolean
  titulo: string
  descripcion?: string
  confirmarLabel?: string
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
  cargando = false,
  error,
  peligro = false,
  onConfirmar,
  onCancelar,
  children,
}: ConfirmModalProps) {
  if (!abierto) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Cancelar"
        className="absolute inset-0 bg-black/30"
        onClick={onCancelar}
      />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-sm font-semibold text-gray-800">{titulo}</h2>
        {descripcion && <p className="mt-1 text-xs text-gray-500">{descripcion}</p>}

        {children && <div className="mt-4 space-y-3">{children}</div>}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variante="secondary" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Button>
          <Button
            variante={peligro ? 'danger' : 'primary'}
            onClick={onConfirmar}
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
