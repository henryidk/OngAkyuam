import type { ReactNode } from 'react'
import { CLASE_EYEBROW, CLASE_H1 } from './estilos'

interface EncabezadoPaginaProps {
  eyebrow: string
  titulo: string
  descripcion?: ReactNode
  /** Lo que va a la derecha del título (totales, botones). */
  extremo?: ReactNode
}

/** Eyebrow en mayúsculas + título de 24px, como abre cada pantalla del mockup. */
export default function EncabezadoPagina({ eyebrow, titulo, descripcion, extremo }: EncabezadoPaginaProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 max-w-2xl">
        <p className={CLASE_EYEBROW}>{eyebrow}</p>
        <h1 className={`mt-1 ${CLASE_H1}`}>{titulo}</h1>
        {descripcion && <p className="mt-1.5 text-sm text-[#5b6573]">{descripcion}</p>}
      </div>
      {extremo && <div className="flex flex-wrap items-center gap-2">{extremo}</div>}
    </div>
  )
}
