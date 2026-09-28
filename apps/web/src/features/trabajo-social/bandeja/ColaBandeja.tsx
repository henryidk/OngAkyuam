import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { Link } from 'react-router-dom'
import Badge from '../../../components/ui/Badge'
import EmptyState from '../../../components/ui/EmptyState'

export type TonoCola = 'warning' | 'brand' | 'success'

const PUNTO_TONO: Record<TonoCola, string> = {
  warning: 'bg-amber-600',
  brand: 'bg-brand-600',
  success: 'bg-green-600',
}

interface ColaBandejaProps {
  titulo: string
  subtitulo: string
  tono: TonoCola
  total: number
  /** Enlace "Ver todas" cuando hay más filas de las que se muestran. */
  verTodas?: string
  children: ReactNode
}

/** Tarjeta de una cola de Inicio (plan §12.3): cabecera con punto de color y contador. */
export default function ColaBandeja({ titulo, subtitulo, tono, total, verTodas, children }: ColaBandejaProps) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${PUNTO_TONO[tono]}`} />
          <h2 className="text-sm font-semibold text-gray-900">{titulo}</h2>
          <span className="ml-auto tabular-nums">
            <Badge tono={tono}>{total}</Badge>
          </span>
        </div>
        <p className="ml-4 mt-1 text-xs text-gray-500">{subtitulo}</p>
      </div>
      {total === 0 ? (
        <div className="p-4">
          <EmptyState Icono={Inbox} titulo="Nada pendiente por aquí" />
        </div>
      ) : (
        <ul className="flex-1">{children}</ul>
      )}
      {verTodas && (
        <Link
          to={verTodas}
          className="border-t border-gray-100 px-4 py-2.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
        >
          Ver todas ({total})
        </Link>
      )}
    </section>
  )
}

interface FilaColaProps {
  usuariaId: string
  nombre: string
  meta: string
  accion: ReactNode
}

/** Fila de una cola: el nombre lleva a la ficha, la acción queda a la derecha. */
export function FilaCola({ usuariaId, nombre, meta, accion }: FilaColaProps) {
  return (
    <li className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Link
          to={`/trabajo-social/usuarias/${usuariaId}`}
          className="block truncate text-sm font-medium text-gray-800 hover:underline"
        >
          {nombre}
        </Link>
        <p className="mt-0.5 truncate text-xs tabular-nums text-gray-500">{meta}</p>
      </div>
      <div className="shrink-0">{accion}</div>
    </li>
  )
}

/** Mismo tamaño que una cola cargada: evita el salto de la rejilla al llegar los datos. */
export function ColaEsqueleto() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((indice) => (
          <div key={indice} className="h-9 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
