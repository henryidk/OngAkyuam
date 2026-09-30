import type { TableroPsicologia } from '@akyuam/shared'

function TarjetaMetrica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-800">{valor}</p>
    </div>
  )
}

/** Las métricas son siempre del día de hoy y de mis casos — vienen del tablero, no se calculan aquí (§4.6 del plan). */
export default function MetricasDelDia({ metricas }: { metricas: TableroPsicologia['metricas'] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <TarjetaMetrica etiqueta="Casos activos" valor={metricas.totalCasosActivos} />
      <TarjetaMetrica etiqueta="Citas hoy" valor={metricas.citasHoyCount} />
      <TarjetaMetrica etiqueta="Referencias sin tomar" valor={metricas.referenciasSinTomarCount} />
    </div>
  )
}
