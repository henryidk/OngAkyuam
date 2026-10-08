import { useRef, useState } from 'react'
import { DOCUMENTO_TAMANIO_MAXIMO_BYTES, mimeTypePermitido, type DocumentoCitaDto } from '@akyuam/shared'
import { extraerMensajeError } from '../../../lib/errors'
import { subirDocumentoCita } from '../api/psicologia.api'
import BotonVerDocumento from '../procesos/BotonVerDocumento'

interface FormatoGeneralProps {
  citaId: string
  documento: DocumentoCitaDto | null
  onSubido: (documento: DocumentoCitaDto) => void
}

const TAMANIO_MAXIMO_MB = Math.round(DOCUMENTO_TAMANIO_MAXIMO_BYTES / (1024 * 1024))

/**
 * El Formato General en papel de la sesión, escaneado. Se sube en cuanto se elige: no depende de
 * guardar el registro, y el servidor vuelve a comprobar el tipo real del archivo.
 */
export default function FormatoGeneral({ citaId, documento, onSubido }: FormatoGeneralProps) {
  const entrada = useRef<HTMLInputElement>(null)
  const [progreso, setProgreso] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return
    if (!mimeTypePermitido(archivo.type)) {
      setError('Solo se aceptan PDF o imágenes (JPG, PNG, WEBP).')
      return
    }
    if (archivo.size > DOCUMENTO_TAMANIO_MAXIMO_BYTES) {
      setError(`El archivo pesa más de ${TAMANIO_MAXIMO_MB} MB.`)
      return
    }
    setError(null)
    setProgreso(0)
    try {
      onSubido(await subirDocumentoCita(citaId, archivo, setProgreso))
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setProgreso(null)
      if (entrada.current) entrada.current.value = ''
    }
  }

  const subiendo = progreso !== null

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Formato General</h3>
        <p className="text-xs text-gray-500">
          La hoja en papel de esta sesión, escaneada. PDF o imagen, hasta {TAMANIO_MAXIMO_MB} MB. Opcional.
        </p>
      </div>

      {documento && !subiendo && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
          <span aria-hidden className="flex-none text-base font-bold text-green-700">
            ✓
          </span>
          <p className="min-w-0 flex-1 truncate text-sm text-gray-800">
            <span className="sr-only">Formato subido: </span>
            {documento.nombreArchivo}
          </p>
          <BotonVerDocumento citaId={citaId} nombreArchivo={documento.nombreArchivo} />
        </div>
      )}

      {subiendo && (
        <div className="space-y-1 rounded-lg border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-600" aria-live="polite">
            Subiendo… {progreso}%
          </p>
          <div
            role="progressbar"
            aria-label="Progreso de la subida"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progreso}
            className="h-1.5 overflow-hidden rounded-full bg-gray-100"
          >
            <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${progreso}%` }} />
          </div>
        </div>
      )}

      <input
        ref={entrada}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Archivo del Formato General"
        onChange={(evento) => void alElegir(evento.target.files?.[0])}
      />
      <button
        type="button"
        disabled={subiendo}
        onClick={() => entrada.current?.click()}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60"
      >
        {documento ? 'Reemplazar archivo' : 'Subir Formato General'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  )
}
