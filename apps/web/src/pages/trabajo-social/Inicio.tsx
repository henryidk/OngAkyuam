import { LayoutDashboard } from 'lucide-react'

export default function Inicio() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <LayoutDashboard size={22} strokeWidth={1.75} />
      </span>
      <div className="space-y-1">
        <p className="text-base font-semibold text-gray-900">Contenido de inicio pendiente de definir</p>
        <p className="text-sm text-gray-500">Aquí vivirá el resumen del panel de trabajo social.</p>
      </div>
    </div>
  )
}
