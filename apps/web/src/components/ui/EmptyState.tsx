import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  Icono: LucideIcon
  titulo: string
  descripcion?: string
  accion?: ReactNode
}

/** Estado vacío que invita a actuar, no un "sin datos" que no dice qué hacer. */
export default function EmptyState({ Icono, titulo, descripcion, accion }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
      <Icono className="h-8 w-8 text-gray-400" />
      <p className="text-sm font-medium text-gray-700">{titulo}</p>
      {descripcion && <p className="max-w-sm text-xs text-gray-500">{descripcion}</p>}
      {accion && <div className="mt-2">{accion}</div>}
    </div>
  )
}
