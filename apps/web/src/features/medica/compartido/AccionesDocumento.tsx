import { useState } from 'react'
import { useToast } from '../../../components/ui/Toast'
import { dispararDescarga } from '../../../lib/documentos/archivoDocumento'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerUrlDocumento } from '../api/medica.api'

type Modo = 'vista' | 'descarga'

/**
 * "Ver" y "Descargar" de un documento médico. La URL firmada se pide al momento, dura poco y
 * nunca se guarda: el servidor revalida el permiso en cada clic.
 */
export default function AccionesDocumento({
  documentoId,
  nombre,
  conDescarga = true,
  obtenerUrl = obtenerUrlDocumento,
}: {
  documentoId: string
  nombre: string
  conDescarga?: boolean
  /** Otra área (Jurídico) pasa su propio endpoint, que valida su permiso y audita. */
  obtenerUrl?: (documentoId: string, modo: Modo) => Promise<string>
}) {
  const { mostrar } = useToast()
  const [pidiendo, setPidiendo] = useState<Modo | null>(null)

  async function abrir(modo: Modo) {
    if (pidiendo) return
    setPidiendo(modo)
    try {
      const url = await obtenerUrl(documentoId, modo)
      if (modo === 'vista') window.open(url, '_blank', 'noopener,noreferrer')
      else dispararDescarga(url)
    } catch (err) {
      mostrar(extraerMensajeError(err), 'error')
    } finally {
      setPidiendo(null)
    }
  }

  const clase = 'rounded px-1 text-[13px] font-semibold text-brand-700 hover:underline disabled:text-gray-400'
  return (
    <div className="flex flex-none items-center gap-2">
      <button type="button" onClick={() => void abrir('vista')} disabled={pidiendo !== null} aria-label={`Ver ${nombre}`} className={clase}>
        {pidiendo === 'vista' ? 'Abriendo…' : 'Ver'}
      </button>
      {conDescarga && (
        <button
          type="button"
          onClick={() => void abrir('descarga')}
          disabled={pidiendo !== null}
          aria-label={`Descargar ${nombre}`}
          className={clase}
        >
          {pidiendo === 'descarga' ? 'Descargando…' : 'Descargar'}
        </button>
      )}
    </div>
  )
}
