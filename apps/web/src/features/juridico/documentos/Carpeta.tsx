import { Folder } from 'lucide-react'
import type { CarpetaDto, DocumentoProcesoDto } from '@akyuam/shared'
import { etiquetaFormato, formatearTamanio } from '../../../lib/documentos/archivoDocumento'
import { fechaDeInstante } from '../compartido/formato'

interface CarpetaProps {
  carpeta: CarpetaDto
  onRenombrar: () => void
  onAgregar: () => void
  onVer: (documento: DocumentoProcesoDto) => void
  onDescargar: (documento: DocumentoProcesoDto) => void
  onRenombrarDocumento: (documento: DocumentoProcesoDto) => void
}

const CLASE_ACCION = 'text-xs font-medium text-brand-700 hover:underline'

export default function Carpeta({
  carpeta,
  onRenombrar,
  onAgregar,
  onVer,
  onDescargar,
  onRenombrarDocumento,
}: CarpetaProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <Folder size={18} aria-hidden="true" className="shrink-0 text-brand-600" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
          {carpeta.nombre}{' '}
          <span className="font-normal text-gray-500 tabular-nums">({carpeta.documentos.length})</span>
        </h3>
        <button type="button" onClick={onRenombrar} className={CLASE_ACCION} aria-label={`Renombrar carpeta ${carpeta.nombre}`}>
          Renombrar
        </button>
        <button type="button" onClick={onAgregar} className={CLASE_ACCION} aria-label={`Agregar archivos a ${carpeta.nombre}`}>
          + Agregar archivos
        </button>
      </header>
      {carpeta.documentos.length === 0 ? (
        <p className="border-t border-gray-100 px-4 py-3 text-sm text-gray-500">Carpeta vacía.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {carpeta.documentos.map((documento) => (
            <li key={documento.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                {etiquetaFormato(documento.mimeType)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{documento.nombreVisible}</p>
                <p className="truncate text-xs text-gray-500 tabular-nums">
                  {formatearTamanio(documento.tamanioBytes)} · {fechaDeInstante(documento.createdAt)} · {documento.subidoPor}
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => onVer(documento)} className={CLASE_ACCION}>
                  Ver
                </button>
                <button type="button" onClick={() => onDescargar(documento)} className={CLASE_ACCION}>
                  Descargar
                </button>
                <button type="button" onClick={() => onRenombrarDocumento(documento)} className={CLASE_ACCION}>
                  Renombrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
