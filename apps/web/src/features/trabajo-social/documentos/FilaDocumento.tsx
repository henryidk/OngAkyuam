import { ETIQUETAS_TIPO_DOCUMENTO, textoVisiblePara, type FilaDocumentoCaso } from '@akyuam/shared'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import { etiquetaFormato, formatearTamanio, metaVersion } from './archivoDocumento'

interface FilaDocumentoProps {
  fila: FilaDocumentoCaso
  subiendo: boolean
  /** Otra subida en curso: se bloquean las acciones de escritura para no mezclar errores. */
  bloqueada: boolean
  onVer: () => void
  onElegirArchivo: () => void
}

function BadgeEstado({ fila }: { fila: FilaDocumentoCaso }) {
  if (fila.vigente) {
    const texto = fila.vigente.version > 1 ? `Subido · v${fila.vigente.version}` : 'Subido'
    return <Badge tono="success">{texto}</Badge>
  }
  if (fila.estado === 'AUN_NO_APLICA') {
    return <Badge tono="neutral">Aún no aplica</Badge>
  }
  return null
}

function metaFila(fila: FilaDocumentoCaso): string {
  if (fila.vigente) {
    return `${fila.vigente.nombreArchivo} · ${formatearTamanio(fila.vigente.tamanioBytes)} · ${metaVersion(fila.vigente)}`
  }
  if (fila.estado === 'AUN_NO_APLICA') {
    return 'Se sube cuando la usuaria egresa del albergue.'
  }
  return fila.requerido ? 'Pendiente de escanear · obligatorio' : 'Pendiente de escanear · opcional'
}

export default function FilaDocumento({ fila, subiendo, bloqueada, onVer, onElegirArchivo }: FilaDocumentoProps) {
  const subido = fila.estado === 'SUBIDO'
  return (
    <li className="grid grid-cols-1 items-center gap-4 border-t border-gray-100 px-5 py-3.5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className={`flex h-11 w-9 flex-shrink-0 items-end justify-center rounded border pb-1 text-[9px] font-semibold ${
            subido ? 'border-brand-200 bg-brand-50 text-brand-600' : 'border-gray-200 bg-gray-50 text-gray-300'
          }`}
        >
          {etiquetaFormato(fila.vigente?.mimeType)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{ETIQUETAS_TIPO_DOCUMENTO[fila.tipo]}</p>
            <BadgeEstado fila={fila} />
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">{metaFila(fila)}</p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-gray-400">Visible para</p>
        <p className="mt-0.5 text-[13px] text-gray-700">{subido ? textoVisiblePara(fila.areasVisibles) : '—'}</p>
      </div>

      <div className="flex items-center gap-2 md:justify-end">
        {subido && (
          <>
            <Button variante="secondary" onClick={onVer}>
              Ver
            </Button>
            <Button variante="secondary" onClick={onElegirArchivo} cargando={subiendo} disabled={bloqueada}>
              Actualizar
            </Button>
          </>
        )}
        {fila.estado === 'FALTANTE' && (
          <Button
            variante="acento"
            className="px-3 text-[13px]"
            onClick={onElegirArchivo}
            cargando={subiendo}
            disabled={bloqueada}
          >
            Subir escaneo
          </Button>
        )}
      </div>
    </li>
  )
}
