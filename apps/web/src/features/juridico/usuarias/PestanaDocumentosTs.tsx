import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'
import { ETIQUETAS_TIPO_DOCUMENTO, formatInstanteGT, type DocumentoVisibleArea } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import Drawer from '../../../components/ui/Drawer'
import EmptyState from '../../../components/ui/EmptyState'
import { dispararDescarga, esImagen, etiquetaFormato, formatearTamanio } from '../../../lib/documentos/archivoDocumento'
import { extraerMensajeError } from '../../../lib/errors'
import { obtenerUrlDocumentoTs } from '../api/juridico.api'
import { Esqueleto } from '../compartido/EstadosVista'
import { useContextoFicha } from './contextoFicha'

/** Visor de un documento de Trabajo Social. Lo reutiliza la ficha de Psicología. */
export function DrawerDocumentoTs({
  expedienteId,
  documento,
  onCerrar,
}: {
  expedienteId: string
  documento: DocumentoVisibleArea
  onCerrar: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [descargando, setDescargando] = useState(false)
  const titulo = ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]

  useEffect(() => {
    let cancelado = false
    obtenerUrlDocumentoTs(expedienteId, documento.id, 'vista')
      .then((respuesta) => {
        if (!cancelado) setUrl(respuesta)
      })
      .catch((err) => {
        if (!cancelado) setError(extraerMensajeError(err))
      })
    return () => {
      cancelado = true
    }
  }, [expedienteId, documento.id])

  async function descargar() {
    setDescargando(true)
    try {
      dispararDescarga(await obtenerUrlDocumentoTs(expedienteId, documento.id, 'descarga'))
    } catch (err) {
      setError(extraerMensajeError(err))
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Drawer
      abierto
      titulo={titulo}
      subtitulo={`${formatInstanteGT(documento.createdAt)} · ${formatearTamanio(documento.tamanioBytes)}`}
      onCerrar={onCerrar}
      pie={
        <Button tamano="md" className="ml-auto" onClick={() => void descargar()} cargando={descargando}>
          Descargar
        </Button>
      }
    >
      {error && <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="aspect-[8.5/11] overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {url &&
          (esImagen(documento.mimeType) ? (
            <img src={url} alt={`Escaneo de ${titulo}`} className="h-full w-full object-contain" referrerPolicy="no-referrer" />
          ) : (
            <iframe src={url} title={`Vista previa de ${titulo}`} className="h-full w-full" referrerPolicy="no-referrer" />
          ))}
      </div>
    </Drawer>
  )
}

export default function PestanaDocumentosTs() {
  const { expedienteTs, errorExpedienteTs } = useContextoFicha()
  const [abierto, setAbierto] = useState<DocumentoVisibleArea | null>(null)

  if (errorExpedienteTs) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorExpedienteTs}</p>
  }
  if (!expedienteTs) return <Esqueleto filas={2} />

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Documentos de Trabajo Social</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Escaneos del expediente. Jurídico tiene acceso completo. Los documentos de cada proceso están dentro del
          proceso.
        </p>
      </div>
      {expedienteTs.documentos.length === 0 ? (
        <div className="p-4">
          <EmptyState Icono={FileText} titulo="Trabajo Social no ha subido documentos a este expediente." />
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {expedienteTs.documentos.map((documento) => (
            <li key={documento.id} className="flex items-center gap-3 px-5 py-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-9 shrink-0 items-center justify-center rounded border border-[#dcc9f0] bg-[#f7f3fc] text-[10px] font-semibold text-[#7346a5]"
              >
                {etiquetaFormato(documento.mimeType)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]}</p>
                <p className="truncate text-xs text-gray-500 tabular-nums">
                  {formatInstanteGT(documento.createdAt)} · {formatearTamanio(documento.tamanioBytes)}
                </p>
              </div>
              <Button variante="secondary" onClick={() => setAbierto(documento)}>
                Ver
              </Button>
            </li>
          ))}
        </ul>
      )}
      {abierto && (
        <DrawerDocumentoTs expedienteId={expedienteTs.id} documento={abierto} onCerrar={() => setAbierto(null)} />
      )}
    </section>
  )
}
