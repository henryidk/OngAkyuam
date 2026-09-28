import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface TarjetaProps {
  titulo: ReactNode
  /** Enlace a la derecha del título (p. ej. "Gestionar accesos"). */
  enlace?: { to: string; texto: string }
  accion?: ReactNode
  className?: string
  children: ReactNode
}

/** Tarjeta de contenido de la ficha: título, acción opcional y cuerpo. */
export default function Tarjeta({ titulo, enlace, accion, className, children }: TarjetaProps) {
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className ?? ''}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-gray-900">{titulo}</h2>
        {enlace && (
          <Link to={enlace.to} className="text-[13px] font-medium text-brand-600 hover:underline">
            {enlace.texto}
          </Link>
        )}
        {accion}
      </div>
      {children}
    </section>
  )
}

/** Fila de un `dl` en rejilla: la columna de etiqueta la fija quien lo usa (`grid-cols-[140px_1fr]`). */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-gray-500">{etiqueta}</dt>
      <dd className="text-gray-800">{children}</dd>
    </>
  )
}
