import axios from 'axios'
import { useRef, useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import {
  CODIGO_TRASLAPE_CITA,
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  agendarCitaPsicologicaSchema,
  formatInstanteCortoGT,
  formatInstanteGT,
  parseLocalGT,
  type AgendarCitaPsicologicaInput,
  type CasoPorAgendarDto,
  type CitaAgendaDto,
  type CitaResumen,
  type ConflictoTraslapeCita,
  type DuracionCitaPsicologica,
  type PersonaAtendidaDto,
  type PersonaParaAbrirDto,
  type ProcesoParaAgendarDto,
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
  /** Primera cita de un caso tomado: al guardarla se abre el proceso de la persona elegida. */
  | { tipo: 'PRIMERA'; caso: CasoPorAgendarDto }
  /**
   * Proceso nuevo desde la ficha, para una persona ya fijada: la usuaria que regresa o uno de
   * sus hijos/as. `codigo` es el que tendrá el proceso.
   */
  | {
      tipo: 'NUEVO'
      usuariaId: string
      usuariaNombreCompleto: string
      persona: PersonaAtendidaDto
      codigo: string
    }
  /** Cita de seguimiento. Sin `procesoId` la psicóloga elige el proceso en el propio modal. */
  | {
      tipo: 'PROCESO'
      procesos: ProcesoParaAgendarDto[]
      procesoId: string | null
      /** La sesión ya ocurrió sin cita previa: se anota cuándo fue y se pasa a registrarla. */
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
   * `citaId` es la cita que quedó programada y `procesoId`, su proceso.
   */
  onGuardada: (fecha: string, mensaje: string, citaId: string, procesoId: string) => void
}

type Paso = 'PERSONA' | 'PROCESO' | 'HORARIO' | 'CONFIRMAR'

/** Se muestran el filtro de la lista de procesos solo cuando ya es larga. */
const PROCESOS_SIN_FILTRO = 6

/** La usuaria si está libre; si no, la primera persona sin proceso abierto. */
function personaInicial(personas: PersonaParaAbrirDto[]): string | null {
  return (personas.find((persona) => persona.atendidaPor === null) ?? personas[0])?.ninoId ?? null
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
 * Programar o mover una cita, en los pasos de "Programar consulta" de Médica: 1) a quién se atiende
 * (en la primera cita de una referencia) o el proceso (si no viene elegido), 2) el día y la hora en
 * la semana con las horas libres, 3) confirmar. Cada persona lleva su propio proceso: abrirlo es
 * agendar su primera cita, y quien la agenda queda como responsable. A
 * diferencia de Médica, el horario no se valida: con "Otra fecha u hora" se agenda donde sea, y un
 * choque con otra cita solo avisa (el servidor responde 409 una vez y la psicóloga confirma).
 *
 * "Registrar sesión sin cita" no usa la semana: la sesión ya ocurrió y solo se anota cuándo fue.
 */
export default function ModalProgramarCita({
  destino,
  fechaInicial,
  horaInicial = '',
  onCerrar,
  onGuardada,
}: ModalProgramarCitaProps) {
  const eligeProceso = destino.tipo === 'PROCESO' && destino.procesoId === null
  const eligePersona = destino.tipo === 'PRIMERA' && destino.caso.personas.length > 1
  const sinCita = destino.tipo === 'PROCESO' && destino.sinCita === true
  const [paso, setPaso] = useState<Paso>(() => {
    if (eligePersona) return 'PERSONA'
    return eligeProceso ? 'PROCESO' : 'HORARIO'
  })
  const [procesoId, setProcesoId] = useState(destino.tipo === 'PROCESO' ? (destino.procesoId ?? '') : '')
  const [filtro, setFiltro] = useState('')
  const [ninoElegido, setNinoElegido] = useState<string | null>(() =>
    destino.tipo === 'PRIMERA' ? personaInicial(destino.caso.personas) : null,
  )
  const [horario, setHorario] = useState<HorarioElegido>({ fecha: fechaInicial, hora: horaInicial })
  const [duracion, setDuracion] = useState<DuracionCitaPsicologica>(() => duracionInicial(destino))
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Una clave por contenido: reintentar lo mismo (doble clic, red) no abre dos procesos, y
  // cambiar cualquier dato cuenta como un envío nuevo.
  const idempotencia = useRef<{ firma: string; clave: string } | null>(null)

  const proceso = destino.tipo === 'PROCESO' ? destino.procesos.find((uno) => uno.procesoId === procesoId) : undefined
  // A quién se atiende: en un proceso, siempre su persona; al abrir uno, la elegida o la fijada.
  let atendida: PersonaAtendidaDto | undefined
  if (destino.tipo === 'PRIMERA') atendida = destino.caso.personas.find((persona) => persona.ninoId === ninoElegido)
  else if (destino.tipo === 'NUEVO') atendida = destino.persona
  else if (destino.tipo === 'MOVER') atendida = destino.cita.persona
  else atendida = proceso?.personas[0]
  const ninoId = atendida?.ninoId ?? null

  let usuaria = ''
  let referencia = ''
  if (destino.tipo === 'PRIMERA') {
    usuaria = destino.caso.usuariaNombreCompleto
    referencia = `Exp. ${destino.caso.expedienteNumero} · referida por Trabajo Social`
  } else if (destino.tipo === 'NUEVO') {
    usuaria = destino.usuariaNombreCompleto
    referencia = `Proceso nuevo ${destino.codigo}`
  } else if (destino.tipo === 'MOVER') {
    usuaria = destino.cita.usuariaNombreCompleto
    referencia = `Proceso ${destino.cita.procesoCodigo} · estaba el ${formatInstanteGT(destino.cita.fechaHora)}`
  } else if (proceso) {
    usuaria = proceso.usuariaNombreCompleto
    referencia = `Proceso ${proceso.codigo}`
  }
  // Si se atiende a un hijo/a, el modal lo nombra a él y dice de quién es hijo/a.
  const hijo = atendida?.ninoId ? atendida : undefined
  const abreProceso = destino.tipo === 'PRIMERA' || destino.tipo === 'NUEVO'

  let titulo = 'Programar cita'
  if (destino.tipo === 'PRIMERA') titulo = 'Agendar primera cita'
  else if (destino.tipo === 'NUEVO') titulo = 'Abrir proceso'
  else if (destino.tipo === 'MOVER') titulo = 'Reprogramar cita'
  else if (sinCita) titulo = 'Registrar sesión sin cita'

  // Los pasos que tiene este modal: sin nada que elegir se salta el 1; sin cita no hay confirmación.
  const pasos: Paso[] = [
    ...(eligePersona ? (['PERSONA'] as const) : []),
    ...(eligeProceso ? (['PROCESO'] as const) : []),
    'HORARIO',
    ...(sinCita ? [] : (['CONFIRMAR'] as const)),
  ]
  const textoPaso: Record<Paso, string> = {
    PERSONA: '¿A quién vas a atender?',
    PROCESO: 'Elige el proceso',
    HORARIO: sinCita ? 'Indica cuándo fue la sesión' : 'Elige el día y la hora',
    CONFIRMAR: 'Confirma la cita',
  }
  const subtitulo =
    pasos.length > 1 ? `Paso ${pasos.indexOf(paso) + 1} de ${pasos.length} · ${textoPaso[paso]}` : textoPaso[paso]

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
    setProcesoId(id)
    irA('HORARIO')
  }

  async function enviar(
    datos: AgendarCitaPsicologicaInput,
  ): Promise<{ mensaje: string; citaId: string; procesoId: string }> {
    if (destino.tipo === 'PRIMERA' || destino.tipo === 'NUEVO') {
      const firma = JSON.stringify(datos)
      if (idempotencia.current?.firma !== firma) {
        idempotencia.current = { firma, clave: crypto.randomUUID() }
      }
      const { clave } = idempotencia.current
      const abierto =
        destino.tipo === 'PRIMERA'
          ? await atenderReferencia(destino.caso.referidoId, datos, clave)
          : await abrirProcesoDesdeFicha(destino.usuariaId, datos, clave)
      const primeraSesion = formatInstanteCortoGT(parseLocalGT(datos.fechaHora))
      return {
        mensaje: `Proceso de ${atendida?.nombreCompleto ?? usuaria} abierto · primera sesión ${primeraSesion}`,
        citaId: abierto.citaId,
        procesoId: abierto.procesoId,
      }
    }
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
      setError(sinCita ? 'Indica la fecha y la hora de la sesión.' : 'Elige el día y la hora de la cita.')
      return null
    }
    return validacion.data
  }

  async function guardar() {
    const datos = datosValidos()
    if (!datos) return
    setError(null)
    setGuardando(true)
    try {
      const { mensaje, citaId, procesoId: guardadaEn } = await enviar(datos)
      onGuardada(horario.fecha, mensaje, citaId, guardadaEn)
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
    if (sinCita) {
      void guardar()
    } else if (datosValidos()) {
      irA('CONFIRMAR')
    }
  }

  const sinProcesos = eligeProceso && destino.tipo === 'PROCESO' && destino.procesos.length === 0
  let confirmarLabel = destino.tipo === 'MOVER' ? 'Reprogramar' : 'Programar cita'
  if (conflicto) confirmarLabel = destino.tipo === 'MOVER' ? 'Reprogramar de todos modos' : 'Programar de todos modos'
  let continuarLabel = 'Continuar'
  if (sinCita) continuarLabel = conflicto ? 'Continuar de todos modos' : 'Continuar al registro'

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
            <Button tamano="md" onClick={() => irA('HORARIO')} disabled={atendida === undefined}>
              Continuar
            </Button>
          )}
          {paso === 'HORARIO' && (
            <Button tamano="md" onClick={continuar} cargando={guardando} disabled={!horario.fecha || !horario.hora}>
              {continuarLabel}
            </Button>
          )}
          {paso === 'CONFIRMAR' && (
            <>
              <Button variante="secondary" tamano="md" onClick={() => irA('HORARIO')} disabled={guardando}>
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
      {/* Paso 1 de una referencia: a quién se atiende. Cada persona lleva su propio proceso. */}
      {paso === 'PERSONA' && destino.tipo === 'PRIMERA' && (
        <ElegirPersona personas={destino.caso.personas} elegida={ninoElegido} onElegir={alCambiar(setNinoElegido)} />
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
                onClick={() => irA(eligePersona ? 'PERSONA' : 'PROCESO')}
                className="flex-none rounded-md px-2 py-1 text-[13px] font-semibold text-brand-700 hover:bg-white"
              >
                Cambiar
              </button>
            )}
          </div>

          {abreProceso && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Al guardar se abre su proceso psicológico, en etapa Inicio. Quedarás como responsable de este proceso.
            </p>
          )}

          {sinCita ? (
            <div className="grid grid-cols-3 gap-3">
              <label className={CLASE_ETIQUETA}>
                Fecha
                <input
                  type="date"
                  value={horario.fecha}
                  onChange={(evento) =>
                    alCambiar(setHorario)({
                      ...horario,
                      fecha: evento.target.value,
                    })
                  }
                  className={CLASE_CAMPO}
                />
              </label>
              <label className={CLASE_ETIQUETA}>
                Hora
                <input
                  type="time"
                  value={horario.hora}
                  onChange={(evento) =>
                    alCambiar(setHorario)({
                      ...horario,
                      hora: evento.target.value,
                    })
                  }
                  className={CLASE_CAMPO}
                />
              </label>
              <label className={CLASE_ETIQUETA}>
                Duración
                <select
                  value={duracion}
                  onChange={(evento) => {
                    const elegida = DURACIONES_CITA_PSICOLOGICA_MINUTOS.find(
                      (minutos) => minutos === Number(evento.target.value),
                    )
                    if (elegida) alCambiar(setDuracion)(elegida)
                  }}
                  className={CLASE_CAMPO}
                >
                  {DURACIONES_CITA_PSICOLOGICA_MINUTOS.map((minutos) => (
                    <option key={minutos} value={minutos}>
                      {minutos} minutos
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <ElegirHorario
              fecha={horario.fecha}
              hora={horario.hora}
              duracion={duracion}
              onDuracion={alCambiar(setDuracion)}
              onCambio={alCambiar(setHorario)}
            />
          )}

          {conflicto && <AvisoTraslape citas={conflicto} accion="Cambia la hora o confirma si es intencional." />}
        </>
      )}

      {/* Paso 3: un resumen con la fecha y la hora bien visibles antes de guardar. */}
      {paso === 'CONFIRMAR' && (
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

interface ElegirPersonaProps {
  personas: PersonaParaAbrirDto[]
  elegida: string | null
  onElegir: (ninoId: string | null) => void
}

/**
 * Tarjetas seleccionables (radios nativos): la usuaria primero y luego cada hijo/a. Quien ya tiene
 * un proceso abierto aparece deshabilitada y dice quién la atiende.
 */
function ElegirPersona({ personas, elegida, onElegir }: ElegirPersonaProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">¿A quién vas a atender?</legend>
      <p className="text-[13px] text-gray-600">
        Las demás personas se pueden abrir después desde la ficha, cuando lo necesiten.
      </p>
      <div role="radiogroup" aria-label="¿A quién vas a atender?" className="space-y-2">
        {personas.map((persona) => {
          const ocupada = persona.atendidaPor !== null
          return (
            <label
              key={persona.ninoId ?? 'usuaria'}
              className={`flex items-center justify-between gap-3 rounded-[10px] border-2 px-4 py-3 text-left transition-colors has-checked:border-brand-600 has-checked:bg-brand-50 has-focus-visible:ring-2 has-focus-visible:ring-brand-500 ${
                ocupada
                  ? 'cursor-not-allowed border-gray-100 bg-gray-50'
                  : 'cursor-pointer border-gray-200 hover:border-brand-300'
              }`}
            >
              <input
                type="radio"
                name="persona-atendida"
                className="sr-only"
                checked={persona.ninoId === elegida}
                disabled={ocupada}
                onChange={() => onElegir(persona.ninoId)}
              />
              <span className="min-w-0">
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
