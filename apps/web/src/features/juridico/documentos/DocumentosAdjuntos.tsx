import type { DocumentoProcesoDto } from '@akyuam/shared'
import { etiquetaFormato } from '../../../lib/documentos/archivoDocumento'

const CLASE_ENLACE = 'text-xs font-medium text-brand-700 hover:underline'

interface DocumentosAdjuntosProps {
  documentos: DocumentoProcesoDto[]
  onVer: (documento: DocumentoProcesoDto) => void
  onDescargar: (documento: DocumentoProcesoDto) => void
}

/** Los documentos propios de una audiencia o una actuación, con Ver y Descargar a mano. */
export default function DocumentosAdjuntos({ documentos, onVer, onDescargar }: DocumentosAdjuntosProps) {
  if (documentos.length === 0) return null
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
      {documentos.map((documento) => (
        <li key={documento.id} className="flex flex-wrap items-center gap-2.5 px-3 py-2">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
            {etiquetaFormato(documento.mimeType)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900">{documento.nombreVisible}</span>
          <button type="button" onClick={() => onVer(documento)} className={CLASE_ENLACE}>
            Ver
          </button>
          <button type="button" onClick={() => onDescargar(documento)} className={CLASE_ENLACE}>
            Descargar
          </button>
        </li>
      ))}
    </ul>
  )
}
