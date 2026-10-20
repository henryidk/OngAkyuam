import { useRef } from 'react'
import { ACCEPT_DOCUMENTOS } from '../../../lib/documentos/archivoDocumento'
import type { FaseCola, ItemCola } from '../../../lib/documentos/useColaSubida'
import FilaArchivo from './FilaArchivo'

/** Lo que esta lista usa de `useColaSubida`. */
interface ColaVisible {
  items: ItemCola[]
  fase: FaseCola
  agregar: (archivos: File[]) => void
  renombrar: (id: string, nombre: string) => void
  quitar: (id: string) => void
  reintentar: (id: string) => Promise<void>
}

/** Los archivos de una subida: elegirlos y nombrarlos, ver el progreso y reintentar los que fallaron. */
export default function ColaArchivos({ cola }: { cola: ColaVisible }) {
  const selector = useRef<HTMLInputElement>(null)
  const enEdicion = cola.fase === 'edicion'
  return (
    <>
      {cola.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          Aún no ha elegido archivos.
        </p>
      ) : (
        <ul className="max-h-[320px] space-y-2 overflow-y-auto">
          {cola.items.map((item) => (
            <FilaArchivo
              key={item.id}
              item={item}
              editable={enEdicion}
              onRenombrar={(nombre) => cola.renombrar(item.id, nombre)}
              onQuitar={() => cola.quitar(item.id)}
              onReintentar={
                cola.fase === 'resultado' && item.estado === 'error' && !item.invalido
                  ? () => void cola.reintentar(item.id)
                  : null
              }
            />
          ))}
        </ul>
      )}

      {enEdicion && (
        <>
          <input
            ref={selector}
            type="file"
            multiple
            accept={ACCEPT_DOCUMENTOS}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(evento) => {
              cola.agregar(Array.from(evento.target.files ?? []))
              evento.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => selector.current?.click()}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            + Agregar archivos
          </button>
        </>
      )}
    </>
  )
}
