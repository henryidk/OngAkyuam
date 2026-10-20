import { CheckCircle2, XCircle } from 'lucide-react'
import { NOMBRE_DOCUMENTO_MAX } from '@akyuam/shared'
import { formatearTamanio } from '../../../lib/documentos/archivoDocumento'
import type { ItemCola } from '../../../lib/documentos/useColaSubida'
import { CLASE_CAMPO } from '../compartido/campos'

/** Un archivo de la cola de subida: nombre editable, progreso, resultado y reintento. */
export default function FilaArchivo({
  item,
  editable,
  onRenombrar,
  onQuitar,
  onReintentar,
}: {
  item: ItemCola
  editable: boolean
  onRenombrar: (nombre: string) => void
  onQuitar: () => void
  onReintentar: (() => void) | null
}) {
  return (
    <li className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {editable && !item.invalido ? (
            <input
              type="text"
              aria-label={`Nombre para ${item.archivo.name}`}
              value={item.nombreVisible}
              maxLength={NOMBRE_DOCUMENTO_MAX}
              onChange={(evento) => onRenombrar(evento.target.value)}
              className={CLASE_CAMPO}
            />
          ) : (
            <p className="truncate text-sm font-medium text-gray-900">{item.nombreVisible || item.archivo.name}</p>
          )}
          <p className="truncate text-xs text-gray-500">
            {item.archivo.name} · {formatearTamanio(item.archivo.size)}
          </p>
          {item.estado === 'subiendo' && (
            <div
              role="progressbar"
              aria-label={`Subiendo ${item.archivo.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={item.progreso}
              className="h-1.5 overflow-hidden rounded-full bg-gray-200"
            >
              <div className="h-full bg-brand-600 transition-[width]" style={{ width: `${item.progreso}%` }} />
            </div>
          )}
          {item.error && <p className="text-xs text-red-700">{item.error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1 text-xs">
          {item.estado === 'listo' && (
            <span className="inline-flex items-center gap-1 font-medium text-green-700">
              <CheckCircle2 size={14} /> Subido
            </span>
          )}
          {item.estado === 'error' && !editable && (
            <span className="inline-flex items-center gap-1 font-medium text-red-700">
              <XCircle size={14} /> No se subió
            </span>
          )}
          {onReintentar && (
            <button type="button" onClick={onReintentar} className="font-medium text-brand-700 hover:underline">
              Reintentar
            </button>
          )}
          {editable && (
            <button type="button" onClick={onQuitar} className="font-medium text-gray-500 hover:text-red-700 hover:underline">
              Quitar
            </button>
          )}
        </div>
      </div>
    </li>
  )
}
