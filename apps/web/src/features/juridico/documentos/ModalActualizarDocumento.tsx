import { useRef, useState } from 'react'
import { FileUp, TriangleAlert } from 'lucide-react'
import type { DocumentoProcesoDto } from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { ACCEPT_DOCUMENTOS, formatearTamanio, validarArchivoDocumento } from '../../../lib/documentos/archivoDocumento'
import { extraerMensajeError } from '../../../lib/errors'
import { reemplazarArchivoDocumento } from '../api/juridico.api'

interface ModalActualizarDocumentoProps {
  procesoId: string
  documento: DocumentoProcesoDto
  onCerrar: () => void
  onHecho: () => void
}

/**
 * Sube un archivo nuevo en lugar del actual. El servidor borra el anterior solo después de
 * guardar el nuevo; el nombre visible, la carpeta y el enlace a audiencia o actuación se quedan.
 */
export default function ModalActualizarDocumento({ procesoId, documento, onCerrar, onHecho }: ModalActualizarDocumentoProps) {
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progreso, setProgreso] = useState<number | null>(null)

  function elegir(elegido: File | undefined) {
    if (!elegido) return
    const motivo = validarArchivoDocumento(elegido)
    setError(motivo)
    setArchivo(motivo ? null : elegido)
  }

  async function confirmar() {
    if (!archivo) return
    setError(null)
    setProgreso(0)
    try {
      await reemplazarArchivoDocumento(procesoId, documento.id, archivo, setProgreso)
      onHecho()
    } catch (err) {
      setError(extraerMensajeError(err))
      setProgreso(null)
    }
  }

  const enviando = progreso !== null

  return (
    <ConfirmModal
      abierto
      titulo="Actualizar documento"
      confirmarLabel={enviando ? `Subiendo… ${progreso}%` : 'Reemplazar archivo'}
      confirmarDeshabilitado={!archivo}
      cargando={enviando}
      error={error}
      onConfirmar={() => void confirmar()}
      onCancelar={onCerrar}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          Documento: <span className="font-medium break-words text-gray-900">{documento.nombreVisible}</span>
        </p>

        <input
          ref={entrada}
          type="file"
          accept={ACCEPT_DOCUMENTOS}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(evento) => {
            elegir(evento.target.files?.[0])
            evento.target.value = ''
          }}
        />
        <button
          type="button"
          disabled={enviando}
          onClick={() => entrada.current?.click()}
          className="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-3.5 py-3 text-left hover:border-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileUp size={18} aria-hidden="true" className="shrink-0 text-brand-600" />
          {archivo ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-gray-900">{archivo.name}</span>
              <span className="block text-xs text-gray-500 tabular-nums">
                {formatearTamanio(archivo.size)} · Elegir otro
              </span>
            </span>
          ) : (
            <span className="min-w-0">
              <span className="block text-sm font-medium text-brand-700">Elegir el archivo nuevo</span>
              <span className="block text-xs text-gray-500">PDF, JPG, PNG o WEBP · máximo 15 MB</span>
            </span>
          )}
        </button>

        <p className="flex gap-2 rounded-lg border border-[#ecd9b8] bg-[#fbf1de] px-3 py-2.5 text-[13px] text-[#8a5a14]">
          <TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            El archivo actual se borrará de forma permanente y no se podrá recuperar. Se conservan el nombre, la carpeta y
            su vínculo con la audiencia o actuación.
          </span>
        </p>
      </div>
    </ConfirmModal>
  )
}
