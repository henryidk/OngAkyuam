import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatFechaGT, hoyGT, sumarDiasGT } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import { RUTAS_PSICOLOGIA } from '../rutas'

interface CabeceraAgendaProps {
  /** Día abierto, "YYYY-MM-DD". */
  fecha: string
  onCambiarFecha: (fecha: string) => void
}

export default function CabeceraAgenda({ fecha, onCambiarFecha }: CabeceraAgendaProps) {
  const esHoy = fecha === hoyGT()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variante="secondary"
            aria-label="Día anterior"
            onClick={() => onCambiarFecha(sumarDiasGT(fecha, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variante="secondary" disabled={esHoy} onClick={() => onCambiarFecha(hoyGT())}>
            Hoy
          </Button>
          <Button
            variante="secondary"
            aria-label="Día siguiente"
            onClick={() => onCambiarFecha(sumarDiasGT(fecha, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <h1 className="text-lg font-semibold text-gray-800">{formatFechaGT(fecha)}</h1>
          <p className="text-xs text-gray-500">{esHoy ? 'Hoy' : 'Otro día'}</p>
        </div>
      </div>

      <Link to={RUTAS_PSICOLOGIA.nuevaCita({ fecha })}>
        <Button>
          <Plus className="h-4 w-4" />
          Agendar cita
        </Button>
      </Link>
    </div>
  )
}
