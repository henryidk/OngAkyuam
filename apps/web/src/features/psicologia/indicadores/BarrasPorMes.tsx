import { MESES_DEL_ANIO, nombreMes, nombreMesCorto, type PeriodoIndicadores } from '@akyuam/shared'
import { proporcion } from './calculos'

interface BarrasPorMesProps {
  anio: number
  /** Los 12 meses, de enero a diciembre. */
  meses: PeriodoIndicadores[]
  /** 1-12, o null si se ve el año completo. */
  mesSeleccionado: number | null
  onElegir: (mes: number | null) => void
}

function plural(cantidad: number, singular: string, pluralizado: string) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralizado}`
}

/** Personas atendidas en cada mes. Tocar una barra muestra el detalle de ese mes; tocarla otra vez lo quita. */
export default function BarrasPorMes({ anio, meses, mesSeleccionado, onElegir }: BarrasPorMesProps) {
  const maximo = Math.max(...meses.map((mes) => mes.personasAtendidas))
  const elegido = mesSeleccionado ? meses[mesSeleccionado - 1] : null

  return (
    <section className="flex flex-col gap-3.5 rounded-lg border border-gray-200 bg-white px-5 py-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 className="text-sm font-semibold text-gray-900">Personas atendidas por mes · {anio}</h2>
        <p className="text-[12.5px] text-gray-500" aria-live="polite">
          {elegido && mesSeleccionado
            ? `${nombreMes(mesSeleccionado)}: ${plural(elegido.personasAtendidas, 'persona', 'personas')} · ${plural(elegido.sesionesRealizadas, 'sesión', 'sesiones')}`
            : 'Toca un mes para ver su detalle'}
        </p>
      </div>

      <div className="grid h-[180px] grid-cols-12 items-end gap-1 sm:gap-2">
        {MESES_DEL_ANIO.map((mes) => {
          const personas = meses[mes - 1].personasAtendidas
          const activo = mes === mesSeleccionado
          return (
            <button
              key={mes}
              type="button"
              aria-pressed={activo}
              aria-label={`${nombreMes(mes)}: ${plural(personas, 'persona atendida', 'personas atendidas')}`}
              onClick={() => onElegir(activo ? null : mes)}
              className="group flex h-full min-w-0 flex-col items-center justify-end gap-1"
            >
              <span className="text-[11.5px] font-semibold text-gray-900">{personas}</span>
              <span
                style={{ height: `${proporcion(personas, maximo)}%` }}
                className={`w-full max-w-[38px] rounded-t ${personas === 0 ? 'min-h-[2px]' : 'min-h-[6px]'} ${
                  activo ? 'bg-brand-950' : 'bg-brand-500 group-hover:bg-brand-600'
                }`}
              />
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-1 border-t border-gray-200 pt-1.5 sm:gap-2">
        {MESES_DEL_ANIO.map((mes) => (
          <span
            key={mes}
            className={`text-center text-[11px] sm:text-xs ${mes === mesSeleccionado ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
          >
            {nombreMesCorto(mes)}
          </span>
        ))}
      </div>
    </section>
  )
}
