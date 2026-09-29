import { Download } from 'lucide-react'
import type { FiltroTipoRegistroReporte, ReportePoblacionQuery } from '@akyuam/shared'
import Button from '../../../components/ui/Button'

const OPCIONES_REGISTRO: { valor: FiltroTipoRegistroReporte; etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Interna y externa' },
  { valor: 'INTERNA', etiqueta: 'Solo interna' },
  { valor: 'EXTERNA', etiqueta: 'Solo externa' },
]

const CLASES_CAMPO =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

interface FiltrosReporteProps {
  filtros: ReportePoblacionQuery
  onCambiar: (filtros: ReportePoblacionQuery) => void
  onDescargar: () => void
  descargando: boolean
  puedeDescargar: boolean
}

/** Barra de filtros del reporte (plan §12.9). */
export default function FiltrosReporte({
  filtros,
  onCambiar,
  onDescargar,
  descargando,
  puedeDescargar,
}: FiltrosReporteProps) {
  return (
    <section className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Desde</span>
        <input
          type="date"
          value={filtros.desde}
          max={filtros.hasta}
          onChange={(event) => onCambiar({ ...filtros, desde: event.target.value })}
          className={CLASES_CAMPO}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Hasta</span>
        <input
          type="date"
          value={filtros.hasta}
          min={filtros.desde}
          onChange={(event) => onCambiar({ ...filtros, hasta: event.target.value })}
          className={CLASES_CAMPO}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Registro</span>
        <select
          value={filtros.tipoRegistro}
          onChange={(event) =>
            onCambiar({ ...filtros, tipoRegistro: event.target.value as FiltroTipoRegistroReporte })
          }
          className={CLASES_CAMPO}
        >
          {OPCIONES_REGISTRO.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={filtros.incluirNinos}
          onChange={(event) => onCambiar({ ...filtros, incluirNinos: event.target.checked })}
          className="h-4 w-4 rounded border-gray-300 accent-brand-600"
        />
        Incluir hijas e hijos
      </label>
      <Button
        tamano="md"
        className="ml-auto"
        onClick={onDescargar}
        cargando={descargando}
        disabled={!puedeDescargar}
      >
        {!descargando && <Download className="h-4 w-4" />}
        Descargar Excel (.xlsx)
      </Button>
    </section>
  )
}
