import type { HuecoLibreDto } from '@akyuam/shared'
import { duracionLegible, horaDeMinutos } from '../compartido/horas'

interface FilaHuecoProps {
  hueco: HuecoLibreDto
  /** Recibe la hora de inicio del tramo ("HH:mm"). */
  onProgramar: (hora: string) => void
}

/** Tramo libre del día. Es una sugerencia de dónde cabe una cita, no el único lugar permitido. */
export default function FilaHueco({ hueco, onProgramar }: FilaHuecoProps) {
  const desde = horaDeMinutos(hueco.desdeMin)
  return (
    <li className="flex items-center gap-4 bg-gray-50/60 px-4 py-2.5">
      <span className="w-12 flex-none font-mono text-xs text-gray-400">{desde}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2">
        <span className="text-sm text-gray-500">
          <strong className="font-semibold text-gray-800">Libre</strong> · {desde} – {horaDeMinutos(hueco.hastaMin)} ·{' '}
          {duracionLegible(hueco.hastaMin - hueco.desdeMin)}
        </span>
        <button
          type="button"
          onClick={() => onProgramar(desde)}
          className="rounded px-1 text-sm font-semibold text-brand-600 hover:text-brand-800"
        >
          + Programar aquí
        </button>
      </div>
    </li>
  )
}
