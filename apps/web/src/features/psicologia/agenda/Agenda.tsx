import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { hoyGT, type CasoPorAgendarDto, type ProcesoPsicologiaAbiertoDto } from '@akyuam/shared'
import { useToast } from '../../../components/ui/Toast'
import { useRecurso } from '../../../lib/useRecurso'
import { listarPorAgendar } from '../api/psicologia.api'
import ModalProgramarCita from '../citas/ModalProgramarCita'
import { useContextoPsicologia } from '../compartido/contexto'
import { useAgendaRango } from '../hooks/useAgendaRango'
import { useTableroDia } from '../hooks/useTableroDia'
import CabeceraAgenda from './CabeceraAgenda'
import ColaPendientesDeAgendar from './ColaPendientesDeAgendar'
import CerradosRecientes from './CerradosRecientes'
import MetricasDelDia from './MetricasDelDia'
import PanelPorAgendar from './PanelPorAgendar'
import VistaDiaAgenda from './VistaDiaAgenda'

/**
 * Su trabajo es planificar el tiempo: a la izquierda lo que ya está agendado, a la derecha lo que
 * falta por agendar (primero los casos recién tomados, que aún no tienen proceso). Este componente solo
 * orquesta —resuelve el día abierto y reparte datos— y no contiene marcado de las secciones.
 *
 * Las vistas de mes y semana entran en la fase 9; hoy la columna principal es la vista día.
 */
export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { mostrar } = useToast()
  const { recargarResumen } = useContextoPsicologia()
  const fecha = searchParams.get('fecha') ?? hoyGT()

  const { tablero, error: errorTablero } = useTableroDia()
  const { citas, error: errorCitas, recargar: recargarCitas } = useAgendaRango(fecha, fecha)
  const { datos: porAgendar, error: errorPorAgendar, recargar: recargarPorAgendar } = useRecurso(listarPorAgendar)
  const [aAgendar, setAAgendar] = useState<CasoPorAgendarDto | null>(null)

  function onCambiarFecha(nuevaFecha: string) {
    // "Hoy" se representa con la URL limpia: la agenda siempre abre en el día actual.
    setSearchParams(nuevaFecha === hoyGT() ? {} : { fecha: nuevaFecha })
  }

  function alAgendar(proceso: ProcesoPsicologiaAbiertoDto, fechaCita: string) {
    setAAgendar(null)
    mostrar(`Proceso ${proceso.codigo} abierto con su primera cita`)
    void recargarPorAgendar()
    recargarResumen()
    // La agenda salta al día de la cita para que se vea dónde quedó.
    if (fechaCita === fecha) void recargarCitas()
    else onCambiarFecha(fechaCita)
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
          <PanelPorAgendar
            casos={porAgendar}
            error={errorPorAgendar?.mensaje ?? null}
            resaltadoId={searchParams.get('porAgendar')}
            onAgendar={setAAgendar}
          />
          {!tablero && !errorTablero && <p className="text-sm text-gray-500">Cargando colas de trabajo…</p>}
          {tablero && (
            <>
              <ColaPendientesDeAgendar procesos={tablero.procesosSinProximaCita} fecha={fecha} />
              <CerradosRecientes cerrados={tablero.cerradosEstaSemana} />
            </>
          )}
        </aside>
      </div>

      {aAgendar && (
        <ModalProgramarCita
          caso={aAgendar}
          fechaInicial={fecha}
          onCerrar={() => setAAgendar(null)}
          onAgendada={alAgendar}
        />
      )}
    </div>
  )
}
