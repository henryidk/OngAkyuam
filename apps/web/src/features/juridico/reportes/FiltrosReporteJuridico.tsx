import { Download } from 'lucide-react'
import type { FiltroEstadoReporteJuridico, PersonalDto, ReporteProcesosJuridicoQuery } from '@akyuam/shared'
import Button from '../../../components/ui/Button'

const OPCIONES_ESTADO: { valor: FiltroEstadoReporteJuridico; etiqueta: string }[] = [
  { valor: 'TODOS', etiqueta: 'Todos' },
  { valor: 'EN_TRAMITE', etiqueta: 'En trámite' },
  { valor: 'SUSPENDIDO', etiqueta: 'Suspendidos' },
  { valor: 'FINALIZADO', etiqueta: 'Finalizados' },
  { valor: 'ABANDONADO', etiqueta: 'Abandonados' },
]

const CLASES_CAMPO =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

interface FiltrosReporteJuridicoProps {
  filtros: ReporteProcesosJuridicoQuery
  onCambiar: (filtros: ReporteProcesosJuridicoQuery) => void
  /** Activas e inactivas: un reporte de años anteriores puede necesitar a quien ya no está. */
  abogadas: PersonalDto[]
  onDescargar: () => void
  descargando: boolean
  puedeDescargar: boolean
}

export default function FiltrosReporteJuridico({
  filtros,
  onCambiar,
  abogadas,
  onDescargar,
  descargando,
  puedeDescargar,
}: FiltrosReporteJuridicoProps) {
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
        <span className="mb-1 block text-xs font-medium text-gray-600">Estado</span>
        <select
          value={filtros.estado}
          onChange={(event) =>
            onCambiar({ ...filtros, estado: event.target.value as FiltroEstadoReporteJuridico })
          }
          className={CLASES_CAMPO}
        >
          {OPCIONES_ESTADO.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Abogada</span>
        <select
          value={filtros.abogadaId ?? ''}
          onChange={(event) => onCambiar({ ...filtros, abogadaId: event.target.value || undefined })}
          className={CLASES_CAMPO}
        >
          <option value="">Todas</option>
          {abogadas.map((abogada) => (
            <option key={abogada.id} value={abogada.id}>
              {abogada.activo ? abogada.nombre : `${abogada.nombre} (inactiva)`}
            </option>
          ))}
        </select>
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
