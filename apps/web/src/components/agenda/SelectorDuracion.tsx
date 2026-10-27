import { useId } from 'react'
import { textoDuracion } from './fechas'

interface SelectorDuracionProps<T extends number> {
  opciones: readonly T[]
  duracion: T
  onCambiar: (duracion: T) => void
}

/** Duración de la cita en botones segmentados. Solo se ofrecen horas donde cabe completa. */
export default function SelectorDuracion<T extends number>({ opciones, duracion, onCambiar }: SelectorDuracionProps<T>) {
  const idEtiqueta = useId()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span id={idEtiqueta} className="text-[13px] font-medium text-gray-900">
        Duración
      </span>
      <div
        role="radiogroup"
        aria-labelledby={idEtiqueta}
        className="grid gap-1 rounded-lg bg-gray-100 p-1"
        style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
      >
        {opciones.map((opcion) => (
          <button
            key={opcion}
            type="button"
            role="radio"
            aria-checked={duracion === opcion}
            onClick={() => onCambiar(opcion)}
            className={`whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium ${
              duracion === opcion ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {textoDuracion(opcion)}
          </button>
        ))}
      </div>
    </div>
  )
}
