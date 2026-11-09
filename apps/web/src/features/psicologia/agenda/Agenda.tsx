import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Plus } from 'lucide-react'
import {
  diaSemanaGT,
  formatFechaLargaGT,
  hoyGT,
  sumarDiasGT,
  type CitaAgendaDto,
  type HuecoLibreDto,
} from '@akyuam/shared'
import AvisoAgenda from '../../../components/AvisoAgenda'
import { useTituloPagina, TituloPrincipal } from '../../../components/TituloPagina'
import Button from '../../../components/ui/Button'
import EmptyState from '../../../components/ui/EmptyState'
import { ErrorVista, Esqueleto } from '../../../components/ui/EstadosVista'
import { useToast } from '../../../components/ui/Toast'
import { useRecurso } from '../../../lib/useRecurso'
import { listarCitasAgenda, listarHuecos, listarProcesosParaAgendar } from '../api/psicologia.api'
import ConfirmarNoAsistio from '../citas/ConfirmarNoAsistio'
import ModalProgramarCita, { type DestinoCita } from '../citas/ModalProgramarCita'
import { useContextoPsicologia } from '../compartido/contexto'
import { horaDeInstante } from '../compartido/horas'
import { RUTAS_PSICOLOGIA, type OrigenPrimeraCita } from '../rutas'
import ControlSemana from './ControlSemana'
import FilaCita from './FilaCita'
import FilaHueco from './FilaHueco'
import NavegadorSemana from './NavegadorSemana'
import PendientesAgenda from './PendientesAgenda'
import PrimeraCitaReservada from './PrimeraCitaReservada'
import {
  citaPrincipal,
  citaYaEmpezo,
  diaDeCita,
  diasVisibles,
  fechaValida,
  lunesDe,
  rangoDeFechas,
  resumenDelDia,
} from './semana'

const DIAS_SEMANA = 7

interface ModalAbierto {
  destino: DestinoCita
  fecha: string
  hora?: string
}

type Renglon =
  | { tipo: 'CITA'; minuto: number; cita: CitaAgendaDto }
  | { tipo: 'HUECO'; minuto: number; hueco: HuecoLibreDto }

function origenDe(valor: string | null): OrigenPrimeraCita {
  return valor === 'ficha' ? 'ficha' : 'atencion'
}

function minutoDe(hora: string): number {
  const [horas, minutos] = hora.split(':').map(Number)
  return horas * 60 + minutos
}

/**
 * Su trabajo es planificar el tiempo: a la izquierda la semana y el día abierto con sus citas y
 * sus tramos libres; a la derecha los procesos sin siguiente fecha. Las sesiones pasadas sin
 * registrar viven en Consultas: aquí solo se avisa cuántas hay. Con `?agendar=<referidoId>` abre
 * la primera cita de una referencia del Área de atención. Este componente solo orquesta: decide
 * qué semana y qué día se ven, y reparte datos.
 */
export default function Agenda() {
  useTituloPagina({ titulo: 'Agenda' })
  const [searchParams, setSearchParams] = useSearchParams()
  const { mostrar } = useToast()
  const { resumen, recargarResumen } = useContextoPsicologia()

  const porRegistrar = resumen?.sesionesPorRegistrar ?? 0
  const hoy = hoyGT()
  const diaPedido = fechaValida(searchParams.get('dia'))
  const semanaPedida = fechaValida(searchParams.get('semana'))
  const lunes = lunesDe(semanaPedida ?? diaPedido ?? hoy)
  const domingo = sumarDiasGT(lunes, DIAS_SEMANA - 1)
  // Sin día en la URL se abre hoy si cae en la semana a la vista; si no, su lunes.
  const dia = diaPedido ?? (hoy >= lunes && hoy <= domingo ? hoy : lunes)

  const semana = useRecurso(useCallback(() => listarCitasAgenda({ desde: lunes, hasta: domingo }), [lunes, domingo]))
  const huecos = useRecurso(useCallback(() => listarHuecos(dia), [dia]))
  const procesos = useRecurso(listarProcesosParaAgendar)

  const [modal, setModal] = useState<ModalAbierto | null>(null)
  const [aMarcar, setAMarcar] = useState<CitaAgendaDto | null>(null)
  // El reloj se lee una vez al abrir la pantalla: basta para decidir cuál de las citas de hoy toca.
  const [ahora] = useState(() => Date.now())
  const agendarId = searchParams.get('agendar')
  const origenAgendar = origenDe(searchParams.get('origen'))

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

  /** La primera cita quedó y el caso ya es suyo: se quita `?agendar` sin dejarlo en el historial. */
  function alGuardarPrimera(fechaCita: string, mensaje: string) {
    mostrar(mensaje)
    recargarTodo()
    setSearchParams(fechaCita === hoy ? {} : { semana: lunesDe(fechaCita), dia: fechaCita }, { replace: true })
  }

  function alIntentarNoAsistio(resultado: { mensaje: string; fechaNueva: string | null } | null) {
    if (resultado) {
      setAMarcar(null)
      mostrar(resultado.mensaje)
      if (resultado.fechaNueva && resultado.fechaNueva !== dia) irA(resultado.fechaNueva)
    }
    // También si falló: lo más probable es que otra pestaña ya la haya registrado.
    recargarTodo()
  }

  const dias = diasVisibles(lunes, dia, new Set(citasPorDia.keys()))
  const fechaLarga = formatFechaLargaGT(dia)
  const titulo = esHoy ? `Hoy, ${fechaLarga.charAt(0).toLowerCase()}${fechaLarga.slice(1)}` : fechaLarga

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <TituloPrincipal className="text-2xl font-semibold tracking-tight text-gray-900">{titulo}</TituloPrincipal>
          <p className="text-sm text-gray-500">{semana.datos ? resumenDelDia(citasDelDia) : 'Cargando…'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ControlSemana
            rango={rangoDeFechas(dias[0], dias[dias.length - 1])}
            onSemanaAnterior={() => moverSemana(-DIAS_SEMANA)}
            onSemanaSiguiente={() => moverSemana(DIAS_SEMANA)}
            onHoy={() => irA(hoy)}
          />
          <Button
            tamano="md"
            className="font-semibold"
            aria-keyshortcuts="N"
            data-atajo="nuevo"
            disabled={!procesos.datos}
            onClick={() =>
              procesos.datos &&
              setModal({ destino: { tipo: 'PROCESO', procesos: procesos.datos, procesoId: null }, fecha: dia })
            }
          >
            <Plus aria-hidden className="h-4 w-4" />
            Programar cita
          </Button>
        </div>
      </div>

      <AvisoAgenda
        sinRegistrar={{
          total: porRegistrar,
          texto: porRegistrar === 1 ? 'Sesión por registrar' : 'Sesiones por registrar',
          to: RUTAS_PSICOLOGIA.consultas(),
        }}
        noLaboral={
          dia === hoy && diaSemanaGT(hoy) >= 6 ? (
            <>
              Hoy no es día laboral: la agenda se programa de lunes a viernes. Si atiendes hoy, regístralo en{' '}
              <Link to={RUTAS_PSICOLOGIA.consultas()} className="font-medium text-brand-700 underline underline-offset-2">
                Consultas › Sesión sin cita
              </Link>
              .
            </>
          ) : null
        }
      />

      <NavegadorSemana
        dias={dias}
        diaAbierto={dia}
        hoy={hoy}
        citasPorDia={citasPorDia}
        diasSinRegistrar={diasSinRegistrar}
        onElegirDia={(elegido) => irA(elegido, lunes)}
      />

      <div className="grid items-start gap-5 pt-1 xl:grid-cols-[minmax(0,1fr)_320px]">
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
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
              {renglones.map((renglon) =>
                renglon.tipo === 'CITA' ? (
                  <FilaCita
                    key={renglon.cita.id}
                    cita={renglon.cita}
                    principal={renglon.cita.id === principalId}
                    enCurso={citaYaEmpezo(renglon.cita, ahora)}
                    onNoAsistio={setAMarcar}
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

        <aside aria-label="Pendientes de agendar" className="xl:sticky xl:top-6">
          <PendientesAgenda sinProxima={resumen?.procesos.SIN_PROXIMA ?? null} />
        </aside>
      </div>

      {agendarId && (
        <PrimeraCitaReservada
          key={agendarId}
          referidoId={agendarId}
          origen={origenAgendar}
          fechaInicial={dia}
          onGuardada={alGuardarPrimera}
        />
      )}

      {modal && (
        <ModalProgramarCita
          destino={modal.destino}
          fechaInicial={modal.fecha}
          horaInicial={modal.hora}
          onCerrar={() => setModal(null)}
          onGuardada={alGuardar}
        />
      )}

      <ConfirmarNoAsistio
        cita={
          aMarcar && {
            id: aMarcar.id,
            descripcion: `${aMarcar.persona.nombreCompleto} · ${aMarcar.codigoProceso}`,
            fechaHora: aMarcar.fechaHora,
            duracionMinutos: aMarcar.duracionMinutos,
          }
        }
        onCancelar={() => setAMarcar(null)}
        onIntento={alIntentarNoAsistio}
      />
    </div>
  )
}
