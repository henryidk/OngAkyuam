import {
  ETIQUETAS_FILTRO_LISTA_USUARIAS,
  FILTROS_LISTA_USUARIAS,
  type FiltroListaUsuarias,
  type ListaUsuariasTs,
} from '@akyuam/shared'

interface FiltrosEstadoProps {
  activo: FiltroListaUsuarias | null
  contadores: ListaUsuariasTs['contadores'] | null
  onCambiar: (filtro: FiltroListaUsuarias | null) => void
}

const OPCIONES: { valor: FiltroListaUsuarias | null; etiqueta: string }[] = [
  { valor: null, etiqueta: 'Todas' },
  ...FILTROS_LISTA_USUARIAS.map((valor) => ({ valor, etiqueta: ETIQUETAS_FILTRO_LISTA_USUARIAS[valor] })),
]

/** Chips de estado con contador (plan §12.4). Los contadores respetan la búsqueda escrita. */
export default function FiltrosEstado({ activo, contadores, onCambiar }: FiltrosEstadoProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
      {OPCIONES.map(({ valor, etiqueta }) => {
        const seleccionado = activo === valor
        const contador = contadores ? contadores[valor ?? 'TODAS'] : null
        return (
          <button
            key={etiqueta}
            type="button"
            aria-pressed={seleccionado}
            onClick={() => onCambiar(valor)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${
              seleccionado
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {etiqueta}
            {contador !== null && <span className="ml-1.5 text-xs tabular-nums opacity-70">{contador}</span>}
          </button>
        )
      })}
    </div>
  )
}
