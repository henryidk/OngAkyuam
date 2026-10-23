import { FileImage, FileText } from 'lucide-react'
import type { DocumentoProcesoDto } from '@akyuam/shared'
import { esImagen, etiquetaFormato } from '../../../lib/documentos/archivoDocumento'

const CLASE_ACCION = 'relative px-2.5 text-xs font-medium text-brand-700 hover:bg-brand-50 focus-visible:bg-brand-50'

interface DocumentosAdjuntosProps {
  documentos: DocumentoProcesoDto[]
  onVer: (documento: DocumentoProcesoDto) => void
  /** Abre el modal para subir un archivo nuevo en lugar de este. */
  onActualizar: (documento: DocumentoProcesoDto) => void
}

/**
 * Los documentos propios de una audiencia o una actuación. Cada uno es una pieza compacta: el archivo
 * y, pegadas a él, sus acciones (Ver, Actualizar) como un grupo de botones. Mide lo que su contenido,
 * así nunca quedan acciones flotando al otro lado de una columna ancha.
 */
export default function DocumentosAdjuntos({ documentos, onVer, onActualizar }: DocumentosAdjuntosProps) {
  if (documentos.length === 0) return null
  return (
    <ul className="flex min-w-0 flex-wrap gap-2">
      {documentos.map((documento) => {
        const Icono = documento.mimeType && esImagen(documento.mimeType) ? FileImage : FileText
        return (
          <li
            key={documento.id}
            className="flex h-8 max-w-full items-stretch divide-x divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            <span className="flex min-w-0 items-center gap-1.5 pr-2.5 pl-2" title={documento.nombreVisible}>
              <Icono size={15} aria-hidden="true" className="shrink-0 text-gray-500" />
              <span className="truncate text-[13px] font-medium text-gray-900">{documento.nombreVisible}</span>
              <span className="shrink-0 text-[11px] text-gray-500">{etiquetaFormato(documento.mimeType)}</span>
            </span>
            <button type="button" onClick={() => onVer(documento)} className={CLASE_ACCION}>
              Ver
              <span className="sr-only"> «{documento.nombreVisible}»</span>
            </button>
            <button type="button" onClick={() => onActualizar(documento)} className={CLASE_ACCION}>
              Actualizar
              <span className="sr-only"> el archivo de «{documento.nombreVisible}»</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
