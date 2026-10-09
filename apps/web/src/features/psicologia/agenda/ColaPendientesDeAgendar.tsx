import type { ProcesoParaAgendarDto } from '@akyuam/shared'
import CodigoProceso from '../compartido/CodigoProceso'
import { BOTON_COLA_MARCA } from './estilos'
import TarjetaCola, { FilaCola } from './TarjetaCola'

interface ColaPendientesDeAgendarProps {
  /** Procesos abiertos que no tienen ninguna cita programada de aquí en adelante. */
  procesos: ProcesoParaAgendarDto[] | null
  error: string | null
  onProgramar: (proceso: ProcesoParaAgendarDto) => void
}

/** "Sin próxima cita": procesos que siguen abiertos pero se quedaron sin siguiente fecha. */
export default function ColaPendientesDeAgendar({ procesos, error, onProgramar }: ColaPendientesDeAgendarProps) {
  return (
    <TarjetaCola
      tono="neutro"
      titulo={`Sin próxima cita${procesos ? ` · ${procesos.length}` : ''}`}
      ayuda={
        procesos?.length === 0
          ? 'Todos tus procesos activos tienen cita.'
          : 'Procesos activos que se quedaron sin siguiente fecha.'
      }
    >
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!procesos && !error && <p className="text-sm text-gray-500">Cargando…</p>}

      {procesos?.map((proceso) => (
        <FilaCola
          key={proceso.procesoId}
          nombre={proceso.usuariaNombreCompleto}
          detalle={<CodigoProceso codigo={proceso.codigo} className="text-gray-600" />}
        >
          <button
            type="button"
            onClick={() => onProgramar(proceso)}
            aria-label={`Programar cita de ${proceso.usuariaNombreCompleto}`}
            className={BOTON_COLA_MARCA}
          >
            Agendar
          </button>
        </FilaCola>
      ))}
    </TarjetaCola>
  )
}
