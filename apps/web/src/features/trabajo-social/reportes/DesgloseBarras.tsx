import type { ConteoReporte } from '@akyuam/shared'

interface DesgloseBarrasProps {
  titulo: string
  conteos: ConteoReporte[]
}

/** Un desglose del reporte como barras horizontales; el ancho es relativo al mayor del grupo. */
export default function DesgloseBarras({ titulo, conteos }: DesgloseBarrasProps) {
  const maximo = Math.max(0, ...conteos.map((conteo) => conteo.total))

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-[13px] font-semibold text-gray-700">{titulo}</h2>
      <ul className="space-y-2">
        {conteos.map((conteo) => (
          <li key={conteo.clave} className="grid grid-cols-[90px_1fr_28px] items-center gap-2 text-[13px]">
            <span className="truncate text-gray-600" title={conteo.etiqueta}>
              {conteo.etiqueta}
            </span>
            <span className="h-2 rounded-full bg-gray-100" aria-hidden="true">
              <span
                className="block h-2 rounded-full bg-brand-500"
                style={{ width: maximo > 0 ? `${(conteo.total / maximo) * 100}%` : '0%' }}
              />
            </span>
            <span className="text-right font-medium tabular-nums text-gray-900">{conteo.total}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DesgloseEsqueleto() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 h-4 w-32 animate-pulse rounded bg-gray-100" />
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((indice) => (
          <div key={indice} className="h-3 animate-pulse rounded bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
