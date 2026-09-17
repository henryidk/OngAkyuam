import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy } from 'lucide-react'
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
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-sm font-semibold text-gray-800">Contraseña temporal</h2>
        <p className="mt-1 text-xs text-gray-500">
          Cópiala ahora y compártela con la persona por un canal seguro. No se volverá a
          mostrar.
        </p>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <code className="flex-1 text-sm font-semibold tracking-wide text-gray-800">
            {passwordTemporal}
          </code>
          <button
            type="button"
            aria-label="Copiar contraseña"
            onClick={copiar}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={onCerrar}>Entendido</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
