import { ChevronLeft, ChevronRight } from 'lucide-react'

const CLASE_FLECHA = 'px-2.5 py-2 text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600'

interface ControlSemanaProps {
  /** Tramo a la vista, ya en texto ("5 – 9 oct 2026"). */
  rango: string
  onSemanaAnterior: () => void
  onSemanaSiguiente: () => void
  onHoy: () => void
}

/** Moverse de semana en semana: las flechas y "Hoy" son un solo control, con el tramo al lado. */
export default function ControlSemana({ rango, onSemanaAnterior, onSemanaSiguiente, onHoy }: ControlSemanaProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex divide-x divide-gray-200 overflow-hidden rounded-md border border-gray-300 bg-white">
        <button type="button" aria-label="Semana anterior" onClick={onSemanaAnterior} className={CLASE_FLECHA}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={onHoy} className={`${CLASE_FLECHA} px-3 text-[13px] font-medium`}>
          Hoy
        </button>
        <button type="button" aria-label="Semana siguiente" onClick={onSemanaSiguiente} className={CLASE_FLECHA}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <span className="whitespace-nowrap text-[13.5px] font-medium text-gray-900 tabular-nums">{rango}</span>
    </div>
  )
}
