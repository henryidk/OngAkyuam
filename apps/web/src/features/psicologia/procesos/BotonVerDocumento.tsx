import { useState } from 'react'
import { useToast } from '../../../components/ui/Toast'
import { dispararDescarga } from '../../../lib/documentos/archivoDocumento'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerUrlDocumentoCita } from '../api/psicologia.api'

/**
 * Abre el documento adjunto a una sesión. El enlace se pide al momento: dura poco y el servidor
 * solo lo entrega a la psicóloga dueña del proceso.
 */
export default function BotonVerDocumento({ citaId, nombreArchivo }: { citaId: string; nombreArchivo: string }) {
  const { mostrar } = useToast()
  const [pidiendo, setPidiendo] = useState(false)

  async function ver() {
    if (pidiendo) return
    setPidiendo(true)
    try {
      dispararDescarga(await obtenerUrlDocumentoCita(citaId))
    } catch (err) {
      mostrar(extraerMensajeError(err), 'error')
    } finally {
      setPidiendo(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void ver()}
      disabled={pidiendo}
      aria-label={`Ver ${nombreArchivo}`}
      className="flex-none rounded px-1 text-sm font-semibold text-brand-700 hover:underline disabled:text-gray-400"
    >
      {pidiendo ? 'Abriendo…' : 'Ver'}
    </button>
  )
}
