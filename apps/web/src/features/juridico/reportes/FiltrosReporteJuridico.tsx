import { Download } from 'lucide-react'
import type { FiltroEstadoReporteJuridico, PersonalDto, ReporteProcesosJuridicoQuery } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import OpcionesPersonal from '../compartido/OpcionesPersonal'

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
  /** Abogadas y procuradoras, activas e inactivas: un reporte de años anteriores puede necesitar a quien ya no está. */
  personal: PersonalDto[]
  /** Años de los expedientes de Jurídico, del más reciente al más antiguo (las carpetas de la lista). */
  anios: number[]
  onDescargar: () => void
  descargando: boolean
  puedeDescargar: boolean
}

export default function FiltrosReporteJuridico({
  filtros,
  onCambiar,
  personal,
  anios,
  onDescargar,
  descargando,
  puedeDescargar,
}: FiltrosReporteJuridicoProps) {
  return (
    <section className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-gray-600">Año del expediente</span>
        <select
          value={filtros.anio ?? ''}
          onChange={(event) => onCambiar({ ...filtros, anio: event.target.value ? Number(event.target.value) : undefined })}
          className={CLASES_CAMPO}
        >
          <option value="">Todos los años (por fechas)</option>
          {/* La carpeta elegida se conserva aunque el resumen todavía no haya cargado. */}
          {[...new Set([...anios, ...(filtros.anio ? [filtros.anio] : [])])]
            .sort((a, b) => b - a)
            .map((anio) => (
              <option key={anio} value={anio}>
                Carpeta {anio}
              </option>
            ))}
        </select>
      </label>
      {filtros.anio ? (
        // Una carpeta incluye todos sus procesos, sin importar cuándo empezaron: las fechas no aplican.
        <p className="max-w-[260px] self-center pt-4 text-xs text-gray-500">
          Incluye todos los procesos de los expedientes de {filtros.anio}, sin importar la fecha de inicio.
        </p>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Desde</span>
            <input
              type="date"
              value={filtros.desde ?? ''}
              max={filtros.hasta}
              onChange={(event) => onCambiar({ ...filtros, desde: event.target.value })}
              className={CLASES_CAMPO}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Hasta</span>
            <input
              type="date"
              value={filtros.hasta ?? ''}
              min={filtros.desde}
              onChange={(event) => onCambiar({ ...filtros, hasta: event.target.value })}
              className={CLASES_CAMPO}
            />
          </label>
        </>
      )}
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
        <span className="mb-1 block text-xs font-medium text-gray-600">Responsable</span>
        <select
          value={filtros.responsableId ?? ''}
          onChange={(event) => onCambiar({ ...filtros, responsableId: event.target.value || undefined })}
          className={CLASES_CAMPO}
        >
          <option value="">Todo el personal</option>
          <OpcionesPersonal personal={personal} />
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
