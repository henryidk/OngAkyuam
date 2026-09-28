import { formatFechaGT, type ExpedienteResumenCaso } from '@akyuam/shared'

interface SelectorCasoProps {
  casos: ExpedienteResumenCaso[]
  seleccionado: ExpedienteResumenCaso
  onSeleccionar: (expedienteId: string) => void
}

/** Documentos y accesos son por caso: con más de un caso se elige cuál ver (plan §11). */
export default function SelectorCaso({ casos, seleccionado, onSeleccionar }: SelectorCasoProps) {
  if (casos.length < 2) return null
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      Caso
      <select
        value={seleccionado.id}
        onChange={(event) => onSeleccionar(event.target.value)}
        className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm tabular-nums text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        {casos.map((caso, indice) => (
          <option key={caso.id} value={caso.id}>
            {caso.numero} · {formatFechaGT(caso.fecha)}
            {indice === 0 ? ' · actual' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
