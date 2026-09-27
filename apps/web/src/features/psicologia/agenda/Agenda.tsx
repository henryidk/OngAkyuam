import { CalendarClock } from 'lucide-react'
import { hoyGT } from '@akyuam/shared'
import { useSearchParams } from 'react-router-dom'
import EmptyState from '../../../components/ui/EmptyState'
import { useAgendaRango } from '../hooks/useAgendaRango'
import FilaCita from '../citas/FilaCita'

/**
 * Vista día de la agenda — vistas mes/semana quedan para la fase de contenido de agenda
 * (§5.2 del plan); esta fase solo deja la ruta y la navegación funcionando.
 */
export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams()
  const fecha = searchParams.get('fecha') ?? hoyGT()
  const { citas, error } = useAgendaRango(fecha, fecha)

  function onCambiarFecha(nuevaFecha: string) {
    setSearchParams({ vista: 'dia', fecha: nuevaFecha })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Fecha</span>
          <input
            type="date"
            value={fecha}
            onChange={(event) => onCambiarFecha(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && citas === null && <p className="text-sm text-gray-500">Cargando agenda…</p>}

      {!error && citas !== null && citas.length === 0 && (
        <EmptyState
          Icono={CalendarClock}
          titulo="Sin citas este día"
          descripcion="No hay citas programadas para la fecha seleccionada."
        />
      )}

      {!error && citas !== null && citas.length > 0 && (
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
      )}
    </div>
  )
}
