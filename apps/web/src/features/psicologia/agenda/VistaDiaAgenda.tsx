import { CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AgendaCita } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import FilaCita from '../citas/FilaCita'
import { RUTAS_PSICOLOGIA } from '../rutas'

interface VistaDiaAgendaProps {
  /** `null` mientras carga — el orquestador distingue los tres estados, aquí solo se renderizan. */
  citas: AgendaCita[] | null
  error: string | null
  fecha: string
}

export default function VistaDiaAgenda({ citas, error, fecha }: VistaDiaAgendaProps) {
  if (error) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  if (citas === null) {
    return <p className="text-sm text-gray-500">Cargando citas del día…</p>
  }

  if (citas.length === 0) {
    return (
      <EmptyState
        Icono={CalendarClock}
        titulo="Sin citas este día"
        descripcion="No hay citas programadas para la fecha seleccionada."
        accion={
          <Link to={RUTAS_PSICOLOGIA.nuevaCita({ fecha })}>
            <Button variante="secondary">Agendar una cita</Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-2">
      {citas.map((cita) => (
        <FilaCita
          key={cita.id}
          cita={cita}
          usuariaNombreCompleto={cita.usuariaNombreCompleto}
          expedienteId={cita.expedienteId}
          mostrarRegistrarConsulta
          mostrarVerExpediente
          mostrarReprogramar
        />
      ))}
    </div>
  )
}
