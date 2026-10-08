import { FILTROS_PROCESOS_PSICOLOGIA, type FiltroProcesosPsicologia } from '@akyuam/shared'

const TEXTOS: Record<FiltroProcesosPsicologia, { titulo: string; detalle: string; claseNumero: string }> = {
  ACTIVOS: { titulo: 'Activos', detalle: 'Inicio + Seguimiento', claseNumero: 'text-gray-900' },
  INICIO: { titulo: 'En inicio', detalle: 'Antes de la primera sesión', claseNumero: 'text-gray-900' },
  SEGUIMIENTO: { titulo: 'En seguimiento', detalle: 'Con sesiones registradas', claseNumero: 'text-brand-700' },
  SIN_PROXIMA: { titulo: 'Sin próxima cita', detalle: 'Activos sin fecha', claseNumero: 'text-amber-800' },
  CERRADOS: { titulo: 'Cerrados', detalle: 'Historial', claseNumero: 'text-green-800' },
}

interface TarjetasFiltroProps {
  filtro: FiltroProcesosPsicologia
  /** null mientras llega el resumen: las tarjetas funcionan igual, solo sin número. */
  totales: Record<FiltroProcesosPsicologia, number> | null
  onElegir: (filtro: FiltroProcesosPsicologia) => void
}

/** Las cinco tarjetas de Procesos: cada una es a la vez un contador y el filtro de la lista. */
export default function TarjetasFiltro({ filtro, totales, onElegir }: TarjetasFiltroProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {FILTROS_PROCESOS_PSICOLOGIA.map((uno) => {
        const { titulo, detalle, claseNumero } = TEXTOS[uno]
        const elegido = uno === filtro
        return (
          <button
            key={uno}
            type="button"
            aria-pressed={elegido}
            onClick={() => onElegir(uno)}
            className={`rounded-xl border px-4 py-3 text-left ${
              elegido ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <span className="block text-xs font-medium text-gray-600">{titulo}</span>
            <span className={`block text-2xl font-semibold tabular-nums ${claseNumero}`}>{totales ? totales[uno] : '–'}</span>
            <span className="block text-xs text-gray-500">{detalle}</span>
          </button>
        )
      })}
    </div>
  )
}
