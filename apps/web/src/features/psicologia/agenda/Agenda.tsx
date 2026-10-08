import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import {
  formatFechaLargaGT,
  hoyGT,
  sumarDiasGT,
  type CitaAgendaDto,
  type HuecoLibreDto,
} from '@akyuam/shared'
import { useTituloPagina } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { extraerMensajeError } from '../../../lib/errors'
import { useRecurso } from '../../../lib/useRecurso'
import {
  listarCitasAgenda,
  listarHuecos,
  listarPorAgendar,
  listarProcesosParaAgendar,
  marcarNoAsistio,
} from '../api/psicologia.api'
import ModalProgramarCita, { type DestinoCita } from '../citas/ModalProgramarCita'
import { useContextoPsicologia } from '../compartido/contexto'
import { horaDeInstante } from '../compartido/horas'
import ColaPendientesDeAgendar from './ColaPendientesDeAgendar'
import FilaCita from './FilaCita'
import FilaHueco from './FilaHueco'
import NavegadorSemana from './NavegadorSemana'
import PanelPorAgendar from './PanelPorAgendar'
import PanelSinRegistrar from './PanelSinRegistrar'
import { citaPrincipal, diaDeCita, diasVisibles, fechaValida, lunesDe, resumenDelDia } from './semana'

/** Lo más atrás que el servidor deja pedir de una vez: seis semanas. */
const DIAS_VENTANA_ATRASADAS = 42
const DIAS_SEMANA = 7

interface ModalAbierto {
  destino: DestinoCita
  fecha: string
  hora?: string
}

type Renglon =
  | { tipo: 'CITA'; minuto: number; cita: CitaAgendaDto }
  | { tipo: 'HUECO'; minuto: number; hueco: HuecoLibreDto }

function minutoDe(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number)
  return horas * 60 + minutos
}

/**
 * Su trabajo es planificar el tiempo: a la izquierda la semana y el día abierto con sus citas y
 * sus tramos libres; a la derecha lo que pide atención (citas que pasaron sin registro, casos
 * tomados sin primera cita y procesos sin siguiente fecha). Este componente solo orquesta: decide
 * qué semana y qué día se ven, y reparte datos.
 */
export default function Agenda() {
  useTituloPagina({ titulo: 'Agenda' })
  const [searchParams, setSearchParams] = useSearchParams()
  const { mostrar } = useToast()
  const { resumen, recargarResumen } = useContextoPsicologia()

  const hoy = hoyGT()
  const diaPedido = fechaValida(searchParams.get('dia'))
  const semanaPedida = fechaValida(searchParams.get('semana'))
  const lunes = lunesDe(semanaPedida ?? diaPedido ?? hoy)
  const domingo = sumarDiasGT(lunes, DIAS_SEMANA - 1)
  // Sin día en la URL se abre hoy si cae en la semana a la vista; si no, su lunes.
  const dia = diaPedido ?? (hoy >= lunes && hoy <= domingo ? hoy : lunes)

  const semana = useRecurso(useCallback(() => listarCitasAgenda({ desde: lunes, hasta: domingo }), [lunes, domingo]))
  const huecos = useRecurso(useCallback(() => listarHuecos(dia), [dia]))
  const atrasadas = useRecurso(
    useCallback(() => listarCitasAgenda({ desde: sumarDiasGT(hoy, -DIAS_VENTANA_ATRASADAS), hasta: hoy }), [hoy]),
  )
  const porAgendar = useRecurso(listarPorAgendar)
  const procesos = useRecurso(listarProcesosParaAgendar)

  const [modal, setModal] = useState<ModalAbierto | null>(null)
  const [aMarcar, setAMarcar] = useState<CitaAgendaDto | null>(null)
  const [marcando, setMarcando] = useState(false)
  const [errorMarcar, setErrorMarcar] = useState<string | null>(null)
  // El reloj se lee una vez al abrir la pantalla: basta para decidir cuál de las citas de hoy toca.
  const [ahora] = useState(() => Date.now())

  const { citasPorDia, diasSinRegistrar } = useMemo(() => {
    const cuenta = new Map<string, number>()
    const pendientes = new Set<string>()
    for (const cita of semana.datos ?? []) {
      const suDia = diaDeCita(cita)
      cuenta.set(suDia, (cuenta.get(suDia) ?? 0) + 1)
      if (cita.sinRegistrar) pendientes.add(suDia)
    }
    return { citasPorDia: cuenta, diasSinRegistrar: pendientes }
  }, [semana.datos])

  const citasDelDia = useMemo(
    () => (semana.datos ?? []).filter((cita) => diaDeCita(cita) === dia),
    [semana.datos, dia],
  )
  const renglones = useMemo<Renglon[]>(() => {
    const citas = citasDelDia.map((cita): Renglon => ({ tipo: 'CITA', minuto: minutoDe(horaDeInstante(cita.fechaHora)), cita }))
    const libres = (huecos.datos ?? []).map((hueco): Renglon => ({ tipo: 'HUECO', minuto: hueco.desdeMin, hueco }))
    return [...citas, ...libres].sort((a, b) => a.minuto - b.minuto)
  }, [citasDelDia, huecos.datos])

  const sinRegistrar = useMemo(() => (atrasadas.datos ?? []).filter((cita) => cita.sinRegistrar), [atrasadas.datos])
  const sinProxima = useMemo(
    () => procesos.datos?.filter((proceso) => proceso.proximaCita === null) ?? null,
    [procesos.datos],
  )

  const esHoy = dia === hoy
  const principalId = esHoy ? citaPrincipal(citasDelDia, ahora) : null

  function irA(nuevoDia: string, nuevaSemana = lunesDe(nuevoDia)) {
    // "Hoy" se representa con la URL limpia: la agenda siempre abre en el día actual.
    setSearchParams(nuevoDia === hoy ? {} : { semana: nuevaSemana, dia: nuevoDia })
  }

  function moverSemana(dias: number) {
    const nuevoLunes = sumarDiasGT(lunes, dias)
    const contieneHoy = hoy >= nuevoLunes && hoy <= sumarDiasGT(nuevoLunes, DIAS_SEMANA - 1)
    irA(contieneHoy ? hoy : nuevoLunes, nuevoLunes)
  }

  function recargarTodo() {
    void semana.recargar()
    void huecos.recargar()
    void atrasadas.recargar()
    void porAgendar.recargar()
    void procesos.recargar()
    recargarResumen()
  }

  function alGuardar(fechaCita: string, mensaje: string) {
    setModal(null)
    mostrar(mensaje)
    recargarTodo()
    // La agenda salta al día de la cita para que se vea dónde quedó.
    if (fechaCita !== dia) irA(fechaCita)
  }

  async function confirmarNoAsistio() {
    if (!aMarcar) return
    setMarcando(true)
    setErrorMarcar(null)
    try {
      await marcarNoAsistio(aMarcar.id)
      setAMarcar(null)
      mostrar('Inasistencia registrada')
    } catch (err) {
      setErrorMarcar(extraerMensajeError(err))
    } finally {
      setMarcando(false)
      // También si falló: lo más probable es que otra pestaña ya la haya registrado.
      recargarTodo()
    }
  }

  function abrirNoAsistio(cita: CitaAgendaDto) {
    setErrorMarcar(null)
    setAMarcar(cita)
  }

  const fechaLarga = formatFechaLargaGT(dia)
  const titulo = esHoy ? `Hoy, ${fechaLarga.charAt(0).toLowerCase()}${fechaLarga.slice(1)}` : fechaLarga

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{titulo}</h1>
          <p className="text-sm text-gray-500">{semana.datos ? resumenDelDia(citasDelDia) : 'Cargando…'}</p>
        </div>
        <Button
          tamano="md"
          disabled={!procesos.datos}
          onClick={() =>
            procesos.datos &&
            setModal({ destino: { tipo: 'PROCESO', procesos: procesos.datos, procesoId: null }, fecha: dia })
          }
        >
          Programar cita
        </Button>
      </div>

      <NavegadorSemana
        dias={diasVisibles(lunes, dia, new Set(citasPorDia.keys()))}
        diaAbierto={dia}
        hoy={hoy}
        citasPorDia={citasPorDia}
        diasSinRegistrar={diasSinRegistrar}
        onElegirDia={(elegido) => irA(elegido, lunes)}
        onSemanaAnterior={() => moverSemana(-DIAS_SEMANA)}
        onSemanaSiguiente={() => moverSemana(DIAS_SEMANA)}
        onHoy={() => irA(hoy)}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <section aria-label={`Citas del ${fechaLarga.toLowerCase()}`}>
          {semana.error ? (
            <ErrorVista
              mensaje={semana.error.mensaje}
              sinPermiso={semana.error.sinPermiso}
              recurso="la agenda"
              onReintentar={() => void semana.recargar()}
            />
          ) : !semana.datos ? (
            <Esqueleto />
          ) : renglones.length === 0 ? (
            <EmptyState
              Icono={CalendarDays}
              titulo="No hay citas este día"
              descripcion={dia < hoy ? 'Fue un día sin citas.' : 'Usa "Programar cita" para agendar una.'}
            />
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {renglones.map((renglon) =>
                renglon.tipo === 'CITA' ? (
                  <FilaCita
                    key={renglon.cita.id}
                    cita={renglon.cita}
                    esHoy={esHoy}
                    principal={renglon.cita.id === principalId}
                    onNoAsistio={abrirNoAsistio}
                    onReprogramar={(cita) =>
                      setModal({
                        destino: { tipo: 'MOVER', cita },
                        fecha: diaDeCita(cita),
                        hora: horaDeInstante(cita.fechaHora),
                      })
                    }
                  />
                ) : (
                  <FilaHueco
                    key={`libre-${renglon.hueco.desdeMin}`}
                    hueco={renglon.hueco}
                    onProgramar={(hora) =>
                      procesos.datos &&
                      setModal({
                        destino: { tipo: 'PROCESO', procesos: procesos.datos, procesoId: null },
                        fecha: dia,
                        hora,
                      })
                    }
                  />
                ),
              )}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <PanelSinRegistrar
            citas={sinRegistrar}
            total={resumen?.citasSinRegistrar ?? 0}
            onVerDia={(elegido) => irA(elegido)}
            onNoAsistio={abrirNoAsistio}
          />
          <PanelPorAgendar
            casos={porAgendar.datos}
            error={porAgendar.error?.mensaje ?? null}
            resaltadoId={searchParams.get('porAgendar')}
            onAgendar={(caso) => setModal({ destino: { tipo: 'PRIMERA', caso }, fecha: dia })}
          />
          <ColaPendientesDeAgendar
            procesos={sinProxima}
            error={procesos.error?.mensaje ?? null}
            onProgramar={(proceso) =>
              procesos.datos &&
              setModal({
                destino: { tipo: 'PROCESO', procesos: procesos.datos, procesoId: proceso.procesoId },
                fecha: dia < hoy ? hoy : dia,
              })
            }
          />
        </aside>
      </div>

      {modal && (
        <ModalProgramarCita
          destino={modal.destino}
          fechaInicial={modal.fecha}
          horaInicial={modal.hora}
          onCerrar={() => setModal(null)}
          onGuardada={alGuardar}
        />
      )}

      <ConfirmModal
        abierto={aMarcar !== null}
        titulo="¿Marcar que no asistió?"
        descripcion={
          aMarcar
            ? `${aMarcar.persona.nombreCompleto} · ${aMarcar.procesoCodigo}. La cita queda como inasistencia y deja de estar pendiente de registro.`
            : undefined
        }
        confirmarLabel="Marcar no asistió"
        cargando={marcando}
        error={errorMarcar}
        onConfirmar={() => void confirmarNoAsistio()}
        onCancelar={() => setAMarcar(null)}
      />
    </div>
  )
}
