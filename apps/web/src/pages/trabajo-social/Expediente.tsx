import { FolderOpen } from 'lucide-react'

export default function Expediente() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <FolderOpen size={22} strokeWidth={1.75} />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-gray-900">Contenido de expediente pendiente de definir</p>
        <p className="text-sm text-gray-500">Aquí vivirá la búsqueda y consulta de casos registrados.</p>
      </div>
    </div>
  )
}
