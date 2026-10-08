import { useState } from 'react'
import { FileText } from 'lucide-react'
import { ETIQUETAS_TIPO_DOCUMENTO, formatInstanteGT, type DocumentoVisibleArea } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { Esqueleto } from '../../../components/ui/EstadosVista'
import { etiquetaFormato, formatearTamanio } from '../../../lib/documentos/archivoDocumento'
import { DrawerDocumentoTs } from '../../juridico/usuarias/PestanaDocumentosTs'
import { useContextoFicha } from './contextoFicha'

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
          Escaneos del expediente que Trabajo Social habilitó para Psicología. Los documentos de cada proceso están
          dentro del proceso.
        </p>
      </div>
      {expedienteTs.documentos.length === 0 ? (
        <div className="p-4">
          <EmptyState
            Icono={FileText}
            titulo="No hay documentos de Trabajo Social visibles para Psicología"
            descripcion="Aparecen aquí cuando Trabajo Social habilita uno para el área."
          />
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
