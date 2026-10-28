import { useState } from 'react'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerUrlDocumentoCita } from '../api/psicologia.api'

/**
 * Abre en una pestaña nueva el documento adjunto a una sesión. El enlace se pide al momento:
 * dura poco y el servidor solo lo entrega a quien puede leer la cita.
 */
export default function BotonVerDocumento({ citaId, nombreArchivo }: { citaId: string; nombreArchivo: string }) {
  const { mostrar } = useToast()
  const [pidiendo, setPidiendo] = useState(false)

  // La pestaña se abre dentro del clic (si se abriera después de esperar la URL, el navegador
  // la bloquearía como ventana emergente) y se le asigna la URL firmada cuando llega.
  async function ver() {
    if (pidiendo) return
    setPidiendo(true)
    const ventana = window.open('', '_blank')
    try {
      const url = await obtenerUrlDocumentoCita(citaId)
      if (ventana) {
        ventana.opener = null
        ventana.location.replace(url)
      } else {
        mostrar('El navegador bloqueó la ventana. Permita las ventanas emergentes para este sitio.', 'error')
      }
    } catch (err) {
      ventana?.close()
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
