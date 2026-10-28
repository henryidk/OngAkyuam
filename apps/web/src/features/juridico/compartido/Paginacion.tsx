import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import Button from '../../../components/ui/Button'

interface PaginacionProps {
  /** Nombre accesible del bloque, ej. "Paginación de procesos". */
  etiqueta: string
  pagina: number
  pageSize: number
  total: number
  onCambiar: (pagina: number) => void
}

function BotonPagina({
  etiqueta,
  deshabilitado,
  onClick,
  children,
}: {
  etiqueta: string
  deshabilitado: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button variante="secondary" aria-label={etiqueta} title={etiqueta} disabled={deshabilitado} onClick={onClick} className="px-2">
      {children}
    </Button>
  )
}

/** Primera, anterior, "Página 2 de 4", siguiente y última. Con una sola página no se dibuja. */
export default function Paginacion({ etiqueta, pagina, pageSize, total, onCambiar }: PaginacionProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize))
  if (totalPaginas <= 1) return null
  const esPrimera = pagina <= 1
  const esUltima = pagina >= totalPaginas
  return (
    <nav aria-label={etiqueta} className="flex items-center gap-1.5">
      <BotonPagina etiqueta="Primera página" deshabilitado={esPrimera} onClick={() => onCambiar(1)}>
        <ChevronsLeft size={16} aria-hidden="true" />
      </BotonPagina>
      <BotonPagina etiqueta="Página anterior" deshabilitado={esPrimera} onClick={() => onCambiar(pagina - 1)}>
        <ChevronLeft size={16} aria-hidden="true" />
      </BotonPagina>
      <span className="px-2 whitespace-nowrap text-gray-700 tabular-nums" aria-current="page">
        Página {pagina} de {totalPaginas}
      </span>
      <BotonPagina etiqueta="Página siguiente" deshabilitado={esUltima} onClick={() => onCambiar(pagina + 1)}>
        <ChevronRight size={16} aria-hidden="true" />
      </BotonPagina>
      <BotonPagina etiqueta="Última página" deshabilitado={esUltima} onClick={() => onCambiar(totalPaginas)}>
        <ChevronsRight size={16} aria-hidden="true" />
      </BotonPagina>
    </nav>
  )
}
