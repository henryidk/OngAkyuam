import { useNavigate, useSearchParams } from 'react-router-dom'
import { hoyGT } from '@akyuam/shared'
import { useAgendaRango } from '../hooks/useAgendaRango'
import { useReclamarCaso } from '../hooks/useReclamarCaso'
import { useTableroDia } from '../hooks/useTableroDia'
import { RUTAS_PSICOLOGIA } from '../rutas'
import CabeceraAgenda from './CabeceraAgenda'
import ColaPendientesDeAgendar from './ColaPendientesDeAgendar'
import ColaReferenciasSinTomar from './ColaReferenciasSinTomar'
import CerradosRecientes from './CerradosRecientes'
import MetricasDelDia from './MetricasDelDia'
import VistaDiaAgenda from './VistaDiaAgenda'

/**
 * Pantalla de entrada del módulo (§5.1 del plan). Su trabajo es planificar el tiempo: a la
 * izquierda lo que ya está agendado, a la derecha lo que falta por agendar. Este componente solo
 * orquesta —resuelve el día abierto y reparte datos— y no contiene marcado de las secciones.
 *
 * Las vistas de mes y semana entran en la fase 9; hoy la columna principal es la vista día.
 */
export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const fecha = searchParams.get('fecha') ?? hoyGT()

  const { tablero, error: errorTablero, recargar: recargarTablero } = useTableroDia()
  const { citas, error: errorCitas } = useAgendaRango(fecha, fecha)
  const { reclamandoId, error: errorReclamar, reclamar } = useReclamarCaso()

  function onCambiarFecha(nuevaFecha: string) {
    // "Hoy" se representa con la URL limpia: `/psicologia` siempre abre en el día actual.
    setSearchParams(nuevaFecha === hoyGT() ? {} : { fecha: nuevaFecha })
  }

  /** Reclamar y agendar es un solo acto: un caso tomado sin primera cita es el fallo que la cola existe para evitar. */
  function onTomarYAgendar(expedienteId: string) {
    void reclamar(expedienteId, () =>
      navigate(RUTAS_PSICOLOGIA.nuevaCita({ expedienteId, tipo: 'PRIMERA_ATENCION', fecha })),
    )
  }

  function onSoloTomar(expedienteId: string) {
    void reclamar(expedienteId, recargarTablero)
  }

  return (
    <div className="space-y-6">
      <CabeceraAgenda fecha={fecha} onCambiarFecha={onCambiarFecha} />

      {errorTablero && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorTablero}</p>
      )}

      {tablero && <MetricasDelDia metricas={tablero.metricas} />}

      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <VistaDiaAgenda citas={citas} error={errorCitas} fecha={fecha} />

        <aside className="space-y-6">
          {!tablero && !errorTablero && <p className="text-sm text-gray-500">Cargando colas de trabajo…</p>}
          {tablero && (
            <>
              <ColaReferenciasSinTomar
                referencias={tablero.referenciasSinTomar}
                reclamandoId={reclamandoId}
                error={errorReclamar}
                onTomarYAgendar={onTomarYAgendar}
                onSoloTomar={onSoloTomar}
              />
              <ColaPendientesDeAgendar procesos={tablero.procesosSinProximaCita} fecha={fecha} />
              <CerradosRecientes cerrados={tablero.cerradosEstaSemana} />
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
