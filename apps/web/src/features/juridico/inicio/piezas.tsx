import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Piezas comunes de las tarjetas del Inicio. */

export const CLASE_TARJETA = 'rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]'
export const CLASE_AMBAR = 'text-[#8a5a14]'
export const CLASE_FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1'

export function plural(total: number, singular: string, varios: string): string {
  return `${total} ${total === 1 ? singular : varios}`
}

interface SeccionProps {
  titulo: string
  ayuda?: string
  /** Cifra junto al título: el total real, aunque se vean menos filas. */
  total?: number
  enlace?: { texto: string; destino: string }
  children: ReactNode
}

export function Seccion({ titulo, ayuda, total, enlace, children }: SeccionProps) {
  return (
    <section className={`${CLASE_TARJETA} flex flex-col overflow-hidden`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-gray-900">
            {titulo}
            {total !== undefined && total > 0 && (
              <span className="rounded-md bg-gray-100 px-1.5 text-xs font-medium tabular-nums text-gray-600">{total}</span>
            )}
          </h2>
          {ayuda && <p className="mt-0.5 text-xs text-gray-500 [text-wrap:pretty]">{ayuda}</p>}
        </div>
        {enlace && (
          <Link to={enlace.destino} className={`rounded text-[13px] font-medium text-brand-700 hover:underline ${CLASE_FOCO}`}>
            {enlace.texto}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="border-t border-gray-100 px-4 py-3.5 text-[13px] text-gray-500">{children}</p>
}
