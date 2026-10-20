import type { CarteraJuridico } from '@akyuam/shared'
import type { OpcionCartera } from './formato'

interface FiltroCarteraProps {
  opciones: OpcionCartera[]
  activa: CarteraJuridico
  onCambiar: (cartera: CarteraJuridico) => void
}

/** Todos · Año en curso · Seguimiento (de un año anterior y todavía abiertos). */
export default function FiltroCartera({ opciones, activa, onCambiar }: FiltroCarteraProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por año de inicio">
      {opciones.map(({ valor, etiqueta, total }) => {
        const elegida = valor === activa
        return (
          <button
            key={valor}
            type="button"
            aria-pressed={elegida}
            onClick={() => onCambiar(valor)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
              elegida ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {etiqueta}
            {total !== null && <span className="ml-1.5 text-xs tabular-nums opacity-70">{total}</span>}
          </button>
        )
      })}
    </div>
  )
}
