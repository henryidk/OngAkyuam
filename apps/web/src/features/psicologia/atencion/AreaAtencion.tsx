import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Inbox } from 'lucide-react'
import { formatFechaGT, formatInstanteGT, hoyGT } from '@akyuam/shared'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { extraerMensajeError } from '../../../lib/errors'
import { tomarCaso } from '../api/psicologia.api'
import { useTableroDia } from '../hooks/useTableroDia'
import FilaCita from '../citas/FilaCita'

function TarjetaMetrica({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-800">{valor}</p>
    </div>
  )
}

export default function AreaAtencion() {
  const { tablero, error, recargar } = useTableroDia()
  const [errorTomar, setErrorTomar] = useState<string | null>(null)
  const [tomandoId, setTomandoId] = useState<string | null>(null)

  async function onTomarCaso(expedienteId: string) {
    setErrorTomar(null)
    setTomandoId(expedienteId)
    try {
      await tomarCaso(expedienteId)
      await recargar()
    } catch (err) {
      setErrorTomar(extraerMensajeError(err))
    } finally {
      setTomandoId(null)
    }
  }

  if (error) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  if (!tablero) {
    return <p className="text-sm text-gray-500">Cargando tablero…</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">{formatFechaGT(hoyGT())}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <TarjetaMetrica etiqueta="Casos activos" valor={tablero.metricas.totalCasosActivos} />
          <TarjetaMetrica etiqueta="Citas hoy" valor={tablero.metricas.citasHoyCount} />
          <TarjetaMetrica etiqueta="Referencias sin tomar" valor={tablero.metricas.referenciasSinTomarCount} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Citas de hoy</h2>
        {tablero.citasHoy.length === 0 ? (
          <EmptyState Icono={CalendarCheck} titulo="Sin citas para hoy" />
        ) : (
          <div className="space-y-2">
            {tablero.citasHoy.map((cita) => (
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
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Referencias sin tomar</h2>
        {errorTomar && <p className="text-sm text-red-600">{errorTomar}</p>}
        {tablero.referenciasSinTomar.length === 0 ? (
          <EmptyState Icono={Inbox} titulo="No hay referencias pendientes" />
        ) : (
          <div className="space-y-2">
            {tablero.referenciasSinTomar.map((referencia) => (
              <div
                key={referencia.expedienteId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <div>
                  <span className="font-medium text-gray-800">{referencia.usuariaNombreCompleto}</span>
                  <span className="ml-2 text-xs text-gray-500">{referencia.numero}</span>
                </div>
                <Button
                  variante="secondary"
                  cargando={tomandoId === referencia.expedienteId}
                  onClick={() => onTomarCaso(referencia.expedienteId)}
                >
                  Tomar caso
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Procesos en seguimiento sin próxima cita</h2>
        {tablero.procesosSinProximaCita.length === 0 ? (
          <p className="text-sm text-gray-400">No hay procesos sin próxima cita.</p>
        ) : (
          <div className="space-y-2">
            {tablero.procesosSinProximaCita.map((proceso) => (
              <div
                key={proceso.expedienteId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm"
              >
                <div>
                  <span className="font-medium text-gray-800">{proceso.usuariaNombreCompleto}</span>
                  <span className="ml-2 text-xs text-gray-500">{proceso.numero}</span>
                </div>
                <Link
                  to={`/psicologia/expedientes/${proceso.expedienteId}/citas/nueva`}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Agendar seguimiento
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {tablero.cerradosEstaSemana.length > 0 && (
        <details className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-800">
            Cerrados esta semana
          </summary>
          <div className="divide-y divide-gray-100 border-t border-gray-100 px-4">
            {tablero.cerradosEstaSemana.map((cerrado) => (
              <div key={cerrado.expedienteId} className="py-2 text-sm">
                <span className="font-medium text-gray-800">{cerrado.usuariaNombreCompleto}</span>
                <span className="ml-2 text-xs text-gray-500">{formatInstanteGT(cerrado.fechaCierre)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
