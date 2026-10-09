import type { ProcesoParaAgendarDto } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import CodigoProceso from '../compartido/CodigoProceso'

interface ColaPendientesDeAgendarProps {
  /** Procesos abiertos que no tienen ninguna cita programada de aquí en adelante. */
  procesos: ProcesoParaAgendarDto[] | null
  error: string | null
  onProgramar: (proceso: ProcesoParaAgendarDto) => void
}

/** "Sin próxima cita": procesos que siguen abiertos pero se quedaron sin siguiente fecha. */
export default function ColaPendientesDeAgendar({ procesos, error, onProgramar }: ColaPendientesDeAgendarProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-800">Sin próxima cita{procesos ? ` · ${procesos.length}` : ''}</h2>
        <p className="text-xs text-gray-500">
          {procesos?.length === 0
            ? 'Todos tus procesos activos tienen cita.'
            : 'Procesos activos que se quedaron sin siguiente fecha.'}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!procesos && !error && <p className="text-sm text-gray-500">Cargando…</p>}

      <ul className="space-y-2">
        {procesos?.map((proceso) => (
          <li
            key={proceso.procesoId}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{proceso.usuariaNombreCompleto}</p>
              <p>
                <CodigoProceso codigo={proceso.codigo} className="text-gray-700" />
              </p>
            </div>
            <Button variante="acento" className="flex-none" onClick={() => onProgramar(proceso)}>
              Programar cita
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
