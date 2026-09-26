import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import {
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_MODALIDAD_CITA,
  formatInstanteGT,
  hoyGT,
  type AgendaCita,
} from '@akyuam/shared'
import { api } from '../../lib/api'
import { extraerMensajeError } from '../../lib/errors'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'

const TONO_ESTADO: Record<AgendaCita['estado'], 'neutral' | 'success' | 'warning' | 'danger'> = {
  PROGRAMADA: 'neutral',
  ATENDIDA: 'success',
  CANCELADA: 'danger',
  NO_ASISTIO: 'warning',
}

export default function AgendaPsicologia() {
  const [desde, setDesde] = useState(hoyGT())
  const [hasta, setHasta] = useState(hoyGT())
  const [citas, setCitas] = useState<AgendaCita[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargarAgenda = useCallback(async () => {
    setCitas(null)
    setError(null)
    try {
      const { data } = await api.get<AgendaCita[]>('/psicologia/agenda', { params: { desde, hasta } })
      setCitas(data)
    } catch (err) {
      setError(extraerMensajeError(err))
    }
  }, [desde, hasta])

  useEffect(() => {
    void cargarAgenda()
  }, [cargarAgenda])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-gray-500">Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!error && citas === null && <p className="text-sm text-gray-500">Cargando agenda…</p>}

      {!error && citas !== null && citas.length === 0 && (
        <EmptyState
          Icono={CalendarClock}
          titulo="Sin citas en este rango"
          descripcion="No hay citas programadas entre las fechas seleccionadas."
        />
      )}

      {!error && citas !== null && citas.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha y hora</th>
                <th className="px-4 py-3 font-medium">Usuaria</th>
                <th className="px-4 py-3 font-medium">Modalidad</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Atendido por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {citas.map((cita) => (
                <tr key={cita.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{formatInstanteGT(cita.fechaHora)}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/psicologia/pacientes/${cita.expedienteId}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {cita.usuariaNombreCompleto}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{ETIQUETAS_MODALIDAD_CITA[cita.modalidad]}</td>
                  <td className="px-4 py-3">
                    <Badge tono={TONO_ESTADO[cita.estado]}>{ETIQUETAS_ESTADO_CITA_PSICOLOGICA[cita.estado]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{cita.atendidoPor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
