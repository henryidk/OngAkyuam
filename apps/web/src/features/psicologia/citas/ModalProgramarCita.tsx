import axios from 'axios'
import { useRef, useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import {
  CODIGO_TRASLAPE_CITA,
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  abrirProcesosPsicologiaSchema,
  agendarCitaPsicologicaSchema,
  formatInstanteCortoGT,
  formatInstanteGT,
  parseLocalGT,
  type AbrirProcesosPsicologiaInput,
  type AgendarCitaPsicologicaInput,
  type CasoPorAgendarDto,
  type CitaAgendaDto,
  type CitaResumen,
  type ConflictoTraslapeCita,
  type DuracionCitaPsicologica,
  type PersonaAtendidaDto,
  type PersonaParaAbrirDto,
  type ProcesoParaAgendarDto,
  textoCodigo,
} from '@akyuam/shared'
import ModalPasos from '../../../components/agenda/ModalPasos'
import TarjetaHorario from '../../../components/agenda/TarjetaHorario'
import Button from '../../../components/ui/Button'
import { extraerMensajeError } from '../../../lib/errors'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../juridico/compartido/campos'
import { abrirProcesoDesdeFicha, atenderReferencia, moverCita, programarCitaEnProceso } from '../api/psicologia.api'
import AvisoTraslape from './AvisoTraslape'
import ElegirHorario, { type HorarioElegido } from './ElegirHorario'

/** Para qué se abre el modal: cada caso guarda contra un endpoint distinto. */
export type DestinoCita =
  /** Primera cita de un caso tomado: al guardarla se abre el proceso de cada persona elegida. */
  | { tipo: 'PRIMERA'; caso: CasoPorAgendarDto }
  /**
   * Procesos nuevos desde la ficha: la usuaria que regresa y/o sus hijos/as. En `personas`, el
   * `numero` es el código que tendrá el proceso; `preseleccion`, quienes vienen ya marcadas.
   */
  | {
      tipo: 'NUEVO'
      usuariaId: string
      usuariaNombreCompleto: string
      personas: PersonaParaAbrirDto[]
      preseleccion: (string | null)[]
    }
  /** Cita de seguimiento. Sin `procesoId` la psicóloga elige el proceso en el propio modal. */
  | {
      tipo: 'PROCESO'
      procesos: ProcesoParaAgendarDto[]
      procesoId: string | null
      /**
       * Sesión sin cita: solo se elige el proceso y se pasa a registrarla (`onProcesoElegido`);
       * la fecha y la hora las pone el servidor al guardar.
       */
      sinCita?: boolean
    }
  /** Mover una cita programada a otra fecha; la persona atendida no cambia. */
  | { tipo: 'MOVER'; cita: CitaAgendaDto }

interface ModalProgramarCitaProps {
  destino: DestinoCita
  /** Día (`YYYY-MM-DD`) que se propone primero; si no tiene espacio, el siguiente que sí. */
  fechaInicial: string
  /** Hora ("HH:mm") preferida, p. ej. la de un hueco libre. */
  horaInicial?: string
  onCerrar: () => void
  /**
   * `fecha` es el día de la cita, para que la agenda salte a él; `mensaje` confirma lo hecho;
   * `citaId` es la cita que quedó programada y `procesoId`, su proceso. Si se abrieron varios
   * procesos, son los de la primera persona.
   */
  onGuardada: (fecha: string, mensaje: string, citaId: string, procesoId: string) => void
  /** Solo en la sesión sin cita: el proceso elegido, para abrir su registro. */
  onProcesoElegido?: (procesoId: string) => void
}

type Paso = 'PERSONA' | 'PROCESO' | 'HORARIO' | 'CONFIRMAR'

/** Se muestran el filtro de la lista de procesos solo cuando ya es larga. */
const PROCESOS_SIN_FILTRO = 6

/** Clave de una persona en el estado del modal: el hijo/a por su id, la usuaria aparte. */
function clavePersona(ninoId: string | null): string {
  return ninoId ?? 'usuaria'
}

/** Clave del horario de una cita que no abre proceso: solo hay una. */
const CITA_UNICA = 'cita'

/** Quiénes vienen marcadas: en una referencia, la usuaria si está libre; si no, la primera libre. */
function eleccionInicial(destino: DestinoCita): (string | null)[] {
  if (destino.tipo === 'NUEVO') {
    // Con una sola persona posible no hay nada que elegir: va marcada.
    return destino.personas.length === 1 ? [destino.personas[0].ninoId] : destino.preseleccion
  }
  if (destino.tipo !== 'PRIMERA') return []
  const { personas } = destino.caso
  const libre = personas.length === 1 ? personas[0] : personas.find((persona) => persona.atendidaPor === null)
  return libre ? [libre.ninoId] : []
}

/** "HH:mm" más unos minutos, sin pasar de medianoche ("" si se pasa o no hay hora). */
function horaMas(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  if (!hora || Number.isNaN(h) || Number.isNaN(m)) return ''
  const total = h * 60 + m + minutos
  if (total >= 24 * 60) return ''
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

interface HorarioCita extends HorarioElegido {
  duracion: DuracionCitaPsicologica
}

/** "Ana", "Ana y Luis", "Ana, Luis y Sofía". */
function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join('')
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

function duracionInicial(destino: DestinoCita): DuracionCitaPsicologica {
  if (destino.tipo !== 'MOVER') return DURACION_CITA_PSICOLOGICA_POR_DEFECTO
  // Una cita anterior al cambio de duraciones puede tener una que ya no se ofrece.
  return (
    DURACIONES_CITA_PSICOLOGICA_MINUTOS.find((minutos) => minutos === destino.cita.duracionMinutos) ??
    DURACION_CITA_PSICOLOGICA_POR_DEFECTO
  )
}

/**
 * Programar o mover una cita, en los pasos de "Programar consulta" de Médica: 1) a quiénes se
 * atiende (al abrir procesos se puede marcar a varias personas) o el proceso (si no viene elegido),
 * 2) el día y la hora de cada cita, 3) confirmar. Cada persona lleva su propio proceso: abrirlo es
 * agendar su primera cita, y quien la agenda queda como responsable. Con varias personas, la cita
 * de cada una se propone justo después de la anterior, y todas se abren juntas o ninguna. A
 * diferencia de Médica, el horario no se valida: con "Otra fecha u hora" se agenda donde sea, y un
 * choque con otra cita solo avisa (el servidor responde 409 una vez y la psicóloga confirma).
 *
 * "Sesión sin cita" solo elige el proceso: el registro se abre en su propia pantalla.
 */
export default function ModalProgramarCita({
  destino,
  fechaInicial,
  horaInicial = '',
  onCerrar,
  onGuardada,
  onProcesoElegido,
}: ModalProgramarCitaProps) {
  const abreProceso = destino.tipo === 'PRIMERA' || destino.tipo === 'NUEVO'
  let personasParaAbrir: PersonaParaAbrirDto[] = []
  if (destino.tipo === 'PRIMERA') personasParaAbrir = destino.caso.personas
  else if (destino.tipo === 'NUEVO') personasParaAbrir = destino.personas
  const eligeProceso = destino.tipo === 'PROCESO' && destino.procesoId === null
  const sinCita = destino.tipo === 'PROCESO' && destino.sinCita === true
  const [elegidas, setElegidas] = useState<(string | null)[]>(() => eleccionInicial(destino))
  // Con una sola persona posible no hay nada que elegir.
  const eligePersona = personasParaAbrir.length > 1
  const [paso, setPaso] = useState<Paso>(() => {
    if (eligePersona) return 'PERSONA'
    return eligeProceso ? 'PROCESO' : 'HORARIO'
  })
  // En el paso de horario, de qué persona elegida es la cita (siempre 0 si no se abre proceso).
  const [indice, setIndice] = useState(0)
  const [procesoId, setProcesoId] = useState(destino.tipo === 'PROCESO' ? (destino.procesoId ?? '') : '')
  const [filtro, setFiltro] = useState('')
  // Solo lo que la psicóloga tocó; lo demás se propone (ver `horarioDe`).
  const [horarios, setHorarios] = useState<Record<string, HorarioCita>>({})
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Una clave por contenido: reintentar lo mismo (doble clic, red) no abre dos procesos, y
  // cambiar cualquier dato cuenta como un envío nuevo.
  const idempotencia = useRef<{ firma: string; clave: string } | null>(null)

  // Las elegidas en el orden de la lista (la usuaria primero), para que los pasos no salten.
  const elegidasEnOrden = personasParaAbrir.filter((persona) => elegidas.includes(persona.ninoId))

  /**
   * Horario de la cita `i`: el que se tocó o, si no, la primera en el día y la hora iniciales y
   * cada siguiente justo cuando termina la anterior, el mismo día.
   */
  function horarioDe(i: number): HorarioCita {
    const clave = abreProceso ? clavePersona(elegidasEnOrden[i]?.ninoId ?? null) : CITA_UNICA
    const tocado = horarios[clave]
    if (tocado) return tocado
    if (i === 0) return { fecha: fechaInicial, hora: horaInicial, duracion: duracionInicial(destino) }
    const anterior = horarioDe(i - 1)
    return {
      fecha: anterior.fecha,
      hora: horaMas(anterior.hora, anterior.duracion),
      duracion: DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
    }
  }

  const actual = horarioDe(indice)
  const horario: HorarioElegido = { fecha: actual.fecha, hora: actual.hora }
  const duracion = actual.duracion

  function cambiarActual(cambio: Partial<HorarioCita>) {
    const clave = abreProceso ? clavePersona(elegidasEnOrden[indice]?.ninoId ?? null) : CITA_UNICA
    setHorarios((previos) => ({ ...previos, [clave]: { ...actual, ...cambio } }))
  }

  const proceso = destino.tipo === 'PROCESO' ? destino.procesos.find((uno) => uno.procesoId === procesoId) : undefined
  // A quién se atiende: en un proceso, siempre su persona; al abrir, la persona de este paso.
  let atendida: PersonaAtendidaDto | undefined
  if (abreProceso) atendida = elegidasEnOrden[indice]
  else if (destino.tipo === 'MOVER') atendida = destino.cita.persona
  else atendida = proceso?.personas[0]
  const ninoId = atendida?.ninoId ?? null
  const varias = elegidasEnOrden.length > 1

  let usuaria = ''
  let referencia = ''
  if (destino.tipo === 'PRIMERA') {
    usuaria = destino.caso.usuariaNombreCompleto
    referencia = `Exp. ${destino.caso.expedienteNumero} · referida por Trabajo Social`
  } else if (destino.tipo === 'NUEVO') {
    usuaria = destino.usuariaNombreCompleto
    referencia = `Proceso nuevo ${elegidasEnOrden[indice]?.numero ?? ''}`
  } else if (destino.tipo === 'MOVER') {
    usuaria = destino.cita.usuariaNombreCompleto
    referencia = `${textoCodigo('Proceso', destino.cita.codigoProceso)} · estaba el ${formatInstanteGT(destino.cita.fechaHora)}`
  } else if (proceso) {
    usuaria = proceso.usuariaNombreCompleto
    referencia = textoCodigo('Proceso', proceso.codigo)
  }
  // Si se atiende a un hijo/a, el modal lo nombra a él y dice de quién es hijo/a.
  const hijo = atendida?.ninoId ? atendida : undefined

  let titulo = 'Programar cita'
  if (destino.tipo === 'PRIMERA') titulo = 'Agendar primera cita'
  else if (destino.tipo === 'NUEVO') titulo = varias ? 'Abrir procesos' : 'Abrir proceso'
  else if (destino.tipo === 'MOVER') titulo = 'Reprogramar cita'
  else if (sinCita) titulo = 'Sesión sin cita'

  // Los pasos que tiene este modal: sin nada que elegir se salta el 1; sin cita solo se elige el
  // proceso; con varias personas hay un paso de horario por cada una.
  const citas = abreProceso ? Math.max(elegidasEnOrden.length, 1) : 1
  const pasos: string[] = sinCita
    ? ['PROCESO']
    : [
        ...(eligePersona ? ['PERSONA'] : []),
        ...(eligeProceso ? ['PROCESO'] : []),
        ...Array.from({ length: citas }, (_, i) => `HORARIO-${i}`),
        'CONFIRMAR',
      ]
  const textoPaso: Record<Paso, string> = {
    PERSONA: '¿A quiénes vas a atender?',
    PROCESO: 'Elige el proceso',
    HORARIO: varias ? `Día y hora de ${atendida?.nombreCompleto ?? ''}` : 'Elige el día y la hora',
    CONFIRMAR: varias ? 'Confirma las citas' : 'Confirma la cita',
  }
  const posicion = pasos.indexOf(paso === 'HORARIO' ? `HORARIO-${indice}` : paso)
  const subtitulo = pasos.length > 1 ? `Paso ${posicion + 1} de ${pasos.length} · ${textoPaso[paso]}` : textoPaso[paso]

  // El aviso de traslape era sobre la hora anterior: al tocar un dato deja de valer.
  function alCambiar<T>(asignar: (valor: T) => void) {
    return (valor: T) => {
      asignar(valor)
      setConflicto(null)
      setError(null)
    }
  }

  function irA(siguiente: Paso) {
    setPaso(siguiente)
    setConflicto(null)
    setError(null)
  }

  function alElegirProceso(id: string) {
    if (sinCita) {
      onProcesoElegido?.(id)
      return
    }
    setProcesoId(id)
    irA('HORARIO')
  }

  async function abrir(datos: AbrirProcesosPsicologiaInput): Promise<{ mensaje: string; citaId: string; procesoId: string }> {
    const firma = JSON.stringify(datos)
    if (idempotencia.current?.firma !== firma) {
      idempotencia.current = { firma, clave: crypto.randomUUID() }
    }
    const { clave } = idempotencia.current
    const { procesos } =
      destino.tipo === 'PRIMERA'
        ? await atenderReferencia(destino.caso.referidoId, datos, clave)
        : await abrirProcesoDesdeFicha(destino.tipo === 'NUEVO' ? destino.usuariaId : '', datos, clave)
    const primeraSesion = formatInstanteCortoGT(parseLocalGT(datos.personas[0].fechaHora))
    const nombres = unirNombres(elegidasEnOrden.map((persona) => persona.nombreCompleto))
    // El servidor devuelve primero el proceso de la usuaria; la respuesta trae a cada persona.
    const primero = procesos.find((uno) => uno.ninoId === elegidasEnOrden[0]?.ninoId) ?? procesos[0]
    return {
      mensaje: varias
        ? `Procesos de ${nombres} abiertos · primera sesión ${primeraSesion}`
        : `Proceso de ${nombres || usuaria} abierto · primera sesión ${primeraSesion}`,
      citaId: primero.citaId,
      procesoId: primero.procesoId,
    }
  }

  async function enviar(
    datos: AgendarCitaPsicologicaInput,
  ): Promise<{ mensaje: string; citaId: string; procesoId: string }> {
    if (destino.tipo === 'MOVER') {
      const { fechaHora, duracionMinutos, confirmarTraslape } = datos
      const movida = await moverCita(destino.cita.id, {
        fechaHora,
        duracionMinutos,
        confirmarTraslape,
      })
      return {
        mensaje: 'Cita reprogramada',
        citaId: movida.id,
        procesoId: movida.procesoId,
      }
    }
    const programada = await programarCitaEnProceso(procesoId, datos)
    return {
      mensaje: 'Cita programada',
      citaId: programada.id,
      procesoId: programada.procesoId,
    }
  }

  /** Las citas de todas las personas elegidas, ya validadas; `null` (con el error puesto) si falta algo. */
  function aperturaValida(): AbrirProcesosPsicologiaInput | null {
    const validacion = abrirProcesosPsicologiaSchema.safeParse({
      personas: elegidasEnOrden.map((persona, i) => {
        const suyo = horarioDe(i)
        return {
          ninoId: persona.ninoId,
          fechaHora: `${suyo.fecha}T${suyo.hora}`,
          duracionMinutos: suyo.duracion,
        }
      }),
      confirmarTraslape: conflicto !== null,
    })
    if (!validacion.success) {
      setError(
        elegidasEnOrden.length === 0
          ? 'Marca al menos a una persona.'
          : 'Falta el día o la hora de alguna cita: vuelve a revisarlas.',
      )
      return null
    }
    return validacion.data
  }

  /** Lo elegido, ya validado; `null` (con el error puesto) si falta algo. */
  function datosValidos(): AgendarCitaPsicologicaInput | null {
    if (destino.tipo === 'PROCESO' && !proceso) {
      setError('Elige el proceso al que pertenece la cita.')
      return null
    }
    const validacion = agendarCitaPsicologicaSchema.safeParse({
      fechaHora: `${horario.fecha}T${horario.hora}`,
      duracionMinutos: duracion,
      ninoId,
      confirmarTraslape: conflicto !== null,
    })
    if (!horario.fecha || !horario.hora || !validacion.success) {
      setError('Elige el día y la hora de la cita.')
      return null
    }
    return validacion.data
  }

  async function guardar() {
    const apertura = abreProceso ? aperturaValida() : null
    const datos = abreProceso ? null : datosValidos()
    if (!apertura && !datos) return
    setError(null)
    setGuardando(true)
    try {
      const { mensaje, citaId, procesoId: guardadaEn } = apertura ? await abrir(apertura) : await enviar(datos!)
      onGuardada(abreProceso ? horarioDe(0).fecha : horario.fecha, mensaje, citaId, guardadaEn)
    } catch (err) {
      const cuerpo = axios.isAxiosError(err) ? (err.response?.data as Partial<ConflictoTraslapeCita> | undefined) : undefined
      if (cuerpo?.codigo === CODIGO_TRASLAPE_CITA && cuerpo.detalle) {
        setConflicto(cuerpo.detalle.citas)
      } else {
        setError(extraerMensajeError(err))
      }
    } finally {
      setGuardando(false)
    }
  }

  function continuar() {
    if (!datosValidos()) return
    if (abreProceso && indice < elegidasEnOrden.length - 1) {
      setIndice(indice + 1)
      irA('HORARIO')
      return
    }
    irA('CONFIRMAR')
  }

  /** Del paso de horario hacia atrás: la cita anterior o, en la primera, elegir de nuevo. */
  function atras() {
    if (indice > 0) {
      setIndice(indice - 1)
      irA('HORARIO')
    } else {
      irA(eligePersona ? 'PERSONA' : 'PROCESO')
    }
  }

  function marcar(ninoIdPersona: string | null, marcada: boolean) {
    setElegidas((previas) => (marcada ? [...previas, ninoIdPersona] : previas.filter((otra) => otra !== ninoIdPersona)))
    setConflicto(null)
    setError(null)
  }

  function marcarTodas(todas: boolean) {
    setElegidas(
      todas ? personasParaAbrir.filter((persona) => persona.atendidaPor === null).map((persona) => persona.ninoId) : [],
    )
    setConflicto(null)
    setError(null)
  }

  const sinProcesos = eligeProceso && destino.tipo === 'PROCESO' && destino.procesos.length === 0
  let confirmarLabel = destino.tipo === 'MOVER' ? 'Reprogramar' : 'Programar cita'
  if (conflicto) confirmarLabel = destino.tipo === 'MOVER' ? 'Reprogramar de todos modos' : 'Programar de todos modos'

  const procesosVisibles =
    destino.tipo === 'PROCESO'
      ? destino.procesos.filter((uno) =>
          `${uno.usuariaNombreCompleto} ${uno.codigo}`.toLowerCase().includes(filtro.trim().toLowerCase()),
        )
      : []

  return (
    <ModalPasos
      titulo={titulo}
      subtitulo={subtitulo}
      pie={
        <>
          <Button variante="secondary" tamano="md" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          {paso === 'PERSONA' && (
            <Button
              tamano="md"
              onClick={() => {
                setIndice(0)
                irA('HORARIO')
              }}
              disabled={elegidasEnOrden.length === 0}
            >
              Continuar
            </Button>
          )}
          {paso === 'HORARIO' && (
            <>
              {indice > 0 && (
                <Button variante="secondary" tamano="md" onClick={atras}>
                  Anterior
                </Button>
              )}
              <Button tamano="md" onClick={continuar} cargando={guardando} disabled={!horario.fecha || !horario.hora}>
                Continuar
              </Button>
            </>
          )}
          {paso === 'CONFIRMAR' && (
            <>
              <Button
                variante="secondary"
                tamano="md"
                onClick={() => {
                  setIndice(Math.max(citas - 1, 0))
                  irA('HORARIO')
                }}
                disabled={guardando}
              >
                Volver
              </Button>
              <Button tamano="md" onClick={() => void guardar()} cargando={guardando}>
                {confirmarLabel}
              </Button>
            </>
          )}
        </>
      }
    >
      {/* Paso 1 al abrir: a quiénes se atiende. Cada persona lleva su propio proceso. */}
      {paso === 'PERSONA' && (
        <ElegirPersonas
          personas={personasParaAbrir}
          elegidas={elegidas}
          onMarcar={marcar}
          onMarcarTodas={marcarTodas}
        />
      )}

      {/* Paso 1: el proceso. Elegirlo pasa solo al paso 2. */}
      {paso === 'PROCESO' &&
        (sinProcesos ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
            Todavía no tienes procesos abiertos. Toma un caso en el Área de atención y agenda su primera cita.
          </p>
        ) : (
          <div className="space-y-2">
            {destino.tipo === 'PROCESO' && destino.procesos.length > PROCESOS_SIN_FILTRO && (
              <label className={CLASE_ETIQUETA}>
                Buscar entre mis procesos
                <input
                  type="search"
                  value={filtro}
                  autoComplete="off"
                  onChange={(evento) => setFiltro(evento.target.value)}
                  placeholder="Nombre o código"
                  className={CLASE_CAMPO}
                />
              </label>
            )}
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {procesosVisibles.map((uno) => (
                <li key={uno.procesoId}>
                  <button
                    type="button"
                    onClick={() => alElegirProceso(uno.procesoId)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left hover:border-brand-300 hover:bg-brand-50 ${
                      uno.procesoId === procesoId ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">
                        {uno.usuariaNombreCompleto}
                      </span>
                      <span className="block text-xs text-gray-500">
                        Proceso {uno.codigo}
                        {uno.personas[0]?.ninoId && ` · ${uno.personas[0].nombreCompleto}`}
                      </span>
                    </span>
                    <span className="flex-none text-xs text-gray-500">
                      {uno.proximaCita ? `Próxima: ${formatInstanteGT(uno.proximaCita.fechaHora)}` : 'Sin próxima cita'}
                    </span>
                  </button>
                </li>
              ))}
              {procesosVisibles.length === 0 && (
                <li className="px-1 py-2 text-sm text-gray-500">Ningún proceso coincide con la búsqueda.</li>
              )}
            </ul>
          </div>
        ))}

      {/* Paso 2: a quién (en una tarjeta) y, debajo, cuándo. */}
      {paso === 'HORARIO' && (
        <>
          <div className="flex items-start justify-between gap-3 rounded-lg border border-brand-100 bg-brand-50 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-gray-900">
                {varias && `${indice + 1} de ${elegidasEnOrden.length} · `}
                {destino.tipo === 'NUEVO' && 'Proceso nuevo de '}
                {hijo ? hijo.nombreCompleto : usuaria}
              </p>
              <p className="text-xs text-gray-500">
                {hijo && `Hijo/a de ${usuaria} · `}
                {referencia}
              </p>
            </div>
            {(eligeProceso || eligePersona) && (
              <button
                type="button"
                onClick={() => {
                  setIndice(0)
                  irA(eligePersona ? 'PERSONA' : 'PROCESO')
                }}
                className="flex-none rounded-md px-2 py-1 text-[13px] font-semibold text-brand-700 hover:bg-white"
              >
                Cambiar
              </button>
            )}
          </div>

          {abreProceso && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {varias
                ? 'Al guardar se abre el proceso psicológico de cada persona, en etapa Inicio. Quedarás como responsable de todos.'
                : 'Al guardar se abre su proceso psicológico, en etapa Inicio. Quedarás como responsable de este proceso.'}
              {indice > 0 && ' Se propone la hora en que termina la cita anterior; puedes cambiarla.'}
            </p>
          )}

          <ElegirHorario
            key={indice}
            fecha={horario.fecha}
            hora={horario.hora}
            duracion={duracion}
            onDuracion={alCambiar((nueva: DuracionCitaPsicologica) => cambiarActual({ duracion: nueva }))}
            onCambio={alCambiar((nuevo: HorarioElegido) => cambiarActual(nuevo))}
          />

          {conflicto && <AvisoTraslape citas={conflicto} accion="Cambia la hora o confirma si es intencional." />}
        </>
      )}

      {/* Paso 3 con varias personas: cada cita en una fila, para revisarlas juntas. */}
      {paso === 'CONFIRMAR' && varias && (
        <div className="space-y-3">
          <p className="text-[13px] text-gray-600">
            Se abren {elegidasEnOrden.length} procesos, cada uno con su primera cita. Si alguno no se puede abrir, no se
            abre ninguno.
          </p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {elegidasEnOrden.map((persona, i) => {
              const suyo = horarioDe(i)
              return (
                <li
                  key={clavePersona(persona.ninoId)}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{persona.nombreCompleto}</span>
                    <span className="block text-xs text-gray-500">
                      {persona.ninoId === null ? 'La usuaria' : `Hijo/a · ${persona.edad} años`} · {persona.numero}
                    </span>
                  </span>
                  <span className="flex-none text-right text-[13px] tabular-nums text-gray-900">
                    {formatInstanteGT(parseLocalGT(`${suyo.fecha}T${suyo.hora}`))}
                    <span className="block text-xs text-gray-500">{suyo.duracion} min</span>
                  </span>
                </li>
              )
            })}
          </ul>
          {conflicto && (
            <AvisoTraslape citas={conflicto} accion="Vuelve para cambiar la hora o confirma si es intencional." />
          )}
        </div>
      )}

      {/* Paso 3: un resumen con la fecha y la hora bien visibles antes de guardar. */}
      {paso === 'CONFIRMAR' && !varias && (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"
          >
            <CalendarCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[13px] text-gray-500">
              {destino.tipo === 'MOVER'
                ? 'Nueva fecha para'
                : destino.tipo === 'PROCESO'
                  ? 'Cita de'
                  : 'Primera cita de'}
            </p>
            <p className="text-base font-semibold text-gray-900">{hijo ? hijo.nombreCompleto : usuaria}</p>
            {hijo && (
              <p className="text-[12.5px] text-gray-500">
                Hijo/a · {hijo.edad} años · hijo/a de {usuaria}
              </p>
            )}
          </div>
          <TarjetaHorario fecha={horario.fecha} hora={horario.hora} duracion={duracion} />
          <p className="text-[12.5px] text-gray-500">{referencia}</p>
          {conflicto && (
            <AvisoTraslape citas={conflicto} accion="Vuelve para cambiar la hora o confirma si es intencional." />
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </ModalPasos>
  )
}

interface ElegirPersonasProps {
  personas: PersonaParaAbrirDto[]
  elegidas: (string | null)[]
  onMarcar: (ninoId: string | null, marcada: boolean) => void
  onMarcarTodas: (todas: boolean) => void
}

/**
 * Tarjetas con casilla (checkbox nativo): la usuaria primero y luego cada hijo/a; se marca a una,
 * a varias o a todas. Quien ya tiene un proceso abierto aparece deshabilitada y dice quién la atiende.
 */
function ElegirPersonas({ personas, elegidas, onMarcar, onMarcarTodas }: ElegirPersonasProps) {
  const libres = personas.filter((persona) => persona.atendidaPor === null)
  const todas = libres.length > 0 && libres.every((persona) => elegidas.includes(persona.ninoId))
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">¿A quiénes vas a atender?</legend>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-gray-600">
          Marca a quienes vas a atender: cada persona tendrá su propio proceso y su primera cita.
        </p>
        {libres.length > 1 && (
          <button
            type="button"
            onClick={() => onMarcarTodas(!todas)}
            className="flex-none rounded-md px-2 py-1 text-[13px] font-semibold text-brand-700 hover:bg-brand-50"
          >
            {todas ? 'Quitar todas' : 'Marcar todas'}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {personas.map((persona) => {
          const ocupada = persona.atendidaPor !== null
          const marcada = elegidas.includes(persona.ninoId)
          return (
            <label
              key={clavePersona(persona.ninoId)}
              className={`flex items-center gap-3 rounded-[10px] border-2 px-4 py-3 text-left transition-colors has-checked:border-brand-600 has-checked:bg-brand-50 has-focus-visible:ring-2 has-focus-visible:ring-brand-500 ${
                ocupada
                  ? 'cursor-not-allowed border-gray-100 bg-gray-50'
                  : 'cursor-pointer border-gray-200 hover:border-brand-300'
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 flex-none rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
                checked={marcada}
                disabled={ocupada}
                onChange={(evento) => onMarcar(persona.ninoId, evento.target.checked)}
              />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${ocupada ? 'text-gray-500' : 'text-gray-900'}`}>
                  {persona.nombreCompleto}
                </span>
                <span className="block text-xs text-gray-500">
                  {persona.ninoId === null ? 'La usuaria' : 'Hijo/a'} · {persona.edad} años
                  {ocupada && ` · Ya la atiende ${persona.atendidaPor}`}
                </span>
              </span>
              <span className="flex-none font-mono text-[13px] font-medium tabular-nums text-gray-500">
                {persona.numero}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
