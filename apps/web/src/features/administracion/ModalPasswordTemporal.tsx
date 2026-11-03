import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, Copy, KeyRound } from 'lucide-react'
import Button from '../../components/ui/Button'

interface ModalPasswordTemporalProps {
  passwordTemporal: string
  onCerrar: () => void
}

/**
 * La contraseña temporal solo existe en la respuesta HTTP de crear/resetear — nunca se
 * vuelve a poder consultar. Este modal es la única oportunidad de copiarla.
 */
export default function ModalPasswordTemporal({
  passwordTemporal,
  onCerrar,
}: ModalPasswordTemporalProps) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(passwordTemporal)
    setCopiado(true)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-password-temporal"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex flex-col items-center px-6 pt-7 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 ring-8 ring-brand-50">
            <KeyRound className="h-6 w-6" />
          </span>
          <h2 id="titulo-password-temporal" className="mt-4 text-base font-semibold text-gray-900">
            Contraseña temporal
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Compártela con la persona por un canal seguro. Deberá cambiarla en su primer ingreso.
          </p>
        </div>

        <div className="px-6 pt-5">
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-brand-300 bg-brand-50 py-2 pr-2 pl-4">
            <code className="flex-1 font-mono text-lg font-semibold tracking-wider break-all text-brand-900">
              {passwordTemporal}
            </code>
            <button
              type="button"
              aria-label="Copiar contraseña"
              onClick={copiar}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                copiado ? 'bg-green-600 text-white' : 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-200 hover:bg-brand-100'
              }`}
            >
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiado ? 'Copiada' : 'Copiar'}
            </button>
          </div>

          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No se volverá a mostrar. Si se pierde, habrá que resetearla de nuevo.
          </p>
        </div>

        <div className="mt-6 flex justify-end border-t border-gray-100 bg-gray-50 px-6 py-3">
          <Button tamano="md" onClick={onCerrar}>
            Entendido
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
