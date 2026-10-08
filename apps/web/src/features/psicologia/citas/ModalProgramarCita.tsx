import axios from 'axios'
import { useRef, useState } from 'react'
import {
  CODIGO_TRASLAPE_CITA,
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  agendarCitaPsicologicaSchema,
  formatInstanteGT,
  type AgendarCitaPsicologicaInput,
  type CasoPorAgendarDto,
  type CitaAgendaDto,
  type CitaResumen,
  type ConflictoTraslapeCita,
  type PersonaAtendidaDto,
  type ProcesoParaAgendarDto,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { extraerMensajeError } from '../../../lib/errors'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../juridico/compartido/campos'
import { abrirProcesoDesdeFicha, atenderReferencia, moverCita, programarCitaEnProceso } from '../api/psicologia.api'
import { etiquetaPersona } from '../compartido/personas'

/** Para qué se abre el modal: cada caso guarda contra un endpoint distinto. */
export type DestinoCita =
  /** Primera cita de un caso tomado: al guardarla se abre el proceso. */
  | { tipo: 'PRIMERA'; caso: CasoPorAgendarDto }
  /** Usuaria que regresa sin referencia nueva: se abre otro proceso sobre el mismo expediente. */
  | { tipo: 'NUEVO'; usuariaId: string; usuariaNombreCompleto: string; expedienteNumero: string }
  /** Cita de seguimiento. Sin `procesoId` la psicóloga elige el proceso en el propio modal. */
  | { tipo: 'PROCESO'; procesos: ProcesoParaAgendarDto[]; procesoId: string | null }
  /** Mover una cita programada a otra fecha; la persona atendida no cambia. */
  | { tipo: 'MOVER'; cita: CitaAgendaDto }

interface ModalProgramarCitaProps {
  destino: DestinoCita
  /** Día (`YYYY-MM-DD`) con el que arranca el campo de fecha. */
  fechaInicial: string
  /** Hora ("HH:mm") ya elegida, p. ej. la de un hueco libre. */
  horaInicial?: string
  onCerrar: () => void
  /** `fecha` es el día de la cita, para que la agenda salte a él; `mensaje` confirma lo hecho. */
  onGuardada: (fecha: string, mensaje: string) => void
}

function duracionInicial(destino: DestinoCita): number {
  const [porDefecto] = DURACIONES_CITA_PSICOLOGICA_MINUTOS
  if (destino.tipo !== 'MOVER') return porDefecto
  // Una cita anterior al rediseño puede tener una duración que ya no se ofrece.
  return DURACIONES_CITA_PSICOLOGICA_MINUTOS.find((minutos) => minutos === destino.cita.duracionMinutos) ?? porDefecto
}

/**
 * Programar o mover una cita. Se pide solo lo mínimo: a quién se atiende, cuándo y cuánto dura.
 * El horario no se valida: si la psicóloga agenda fuera de lo habitual, se asume que atiende.
 */
export default function ModalProgramarCita({
  destino,
  fechaInicial,
  horaInicial = '',
  onCerrar,
  onGuardada,
}: ModalProgramarCitaProps) {
  const [procesoId, setProcesoId] = useState(destino.tipo === 'PROCESO' ? (destino.procesoId ?? '') : '')
  const [ninoId, setNinoId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(fechaInicial)
  const [hora, setHora] = useState(horaInicial)
  const [duracion, setDuracion] = useState<number>(() => duracionInicial(destino))
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Una clave por contenido: reintentar lo mismo (doble clic, red) no abre dos procesos, y
  // cambiar cualquier dato cuenta como un envío nuevo.
  const idempotencia = useRef<{ firma: string; clave: string } | null>(null)

  const eligeProceso = destino.tipo === 'PROCESO' && destino.procesoId === null
  const proceso = destino.tipo === 'PROCESO' ? destino.procesos.find((uno) => uno.procesoId === procesoId) : undefined
  let personas: PersonaAtendidaDto[] = []
  if (destino.tipo === 'PRIMERA') personas = destino.caso.personas
  else if (proceso) personas = proceso.personas

  let titulo = 'Programar cita'
  let descripcion = 'Elige el proceso y la fecha.'
  if (destino.tipo === 'PRIMERA') {
    titulo = 'Agendar primera cita'
    descripcion = `${destino.caso.usuariaNombreCompleto} · Exp. ${destino.caso.expedienteNumero} · referida por Trabajo Social`
  } else if (destino.tipo === 'NUEVO') {
    titulo = 'Abrir nuevo proceso'
    descripcion = `${destino.usuariaNombreCompleto} · Exp. ${destino.expedienteNumero} · agenda su primera cita`
  } else if (destino.tipo === 'MOVER') {
    titulo = 'Reprogramar cita'
    descripcion = `${destino.cita.persona.nombreCompleto} · ${destino.cita.procesoCodigo} · estaba el ${formatInstanteGT(destino.cita.fechaHora)}`
  } else if (!eligeProceso && proceso) {
    descripcion = `${proceso.usuariaNombreCompleto} · ${proceso.codigo}`
  }

  // El aviso de traslape era sobre la hora anterior: al tocar un dato deja de valer.
  function alCambiar<T>(asignar: (valor: T) => void) {
    return (valor: T) => {
      asignar(valor)
      setConflicto(null)
      setError(null)
    }
  }

  function alElegirProceso(id: string) {
    alCambiar(setProcesoId)(id)
    // Las personas son las del expediente de ese proceso: se vuelve a la usuaria.
    setNinoId(null)
  }

  async function enviar(datos: AgendarCitaPsicologicaInput): Promise<string> {
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
      return `Proceso ${abierto.codigo} abierto con su primera cita`
    }
    if (destino.tipo === 'MOVER') {
      const { fechaHora, duracionMinutos, confirmarTraslape } = datos
      await moverCita(destino.cita.id, { fechaHora, duracionMinutos, confirmarTraslape })
      return 'Cita reprogramada'
    }
    await programarCitaEnProceso(procesoId, datos)
    return 'Cita programada'
  }

  async function guardar() {
    if (destino.tipo === 'PROCESO' && !proceso) {
      setError('Elige el proceso al que pertenece la cita.')
      return
    }
    const validacion = agendarCitaPsicologicaSchema.safeParse({
      fechaHora: `${fecha}T${hora}`,
      duracionMinutos: duracion,
      ninoId,
      confirmarTraslape: conflicto !== null,
    })
    if (!fecha || !hora || !validacion.success) {
      setError('Indica la fecha y la hora de la cita.')
      return
    }

    setError(null)
    setGuardando(true)
    try {
      onGuardada(fecha, await enviar(validacion.data))
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

  const sinProcesos = eligeProceso && destino.procesos.length === 0
  let confirmarLabel = destino.tipo === 'MOVER' ? 'Reprogramar' : 'Programar cita'
  if (conflicto) confirmarLabel = destino.tipo === 'MOVER' ? 'Reprogramar de todos modos' : 'Programar de todos modos'

  return (
    <ConfirmModal
      abierto
      titulo={titulo}
      descripcion={descripcion}
      confirmarLabel={confirmarLabel}
      confirmarDeshabilitado={sinProcesos}
      cargando={guardando}
      error={error}
      onConfirmar={() => void guardar()}
      onCancelar={onCerrar}
    >
      {(destino.tipo === 'PRIMERA' || destino.tipo === 'NUEVO') && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Al guardar se abre el proceso psicológico de la usuaria, en etapa Inicio.
        </p>
      )}

      {sinProcesos && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Todavía no tienes procesos abiertos. Toma un caso en el Área de atención y agenda su primera cita.
        </p>
      )}

      {eligeProceso && !sinProcesos && (
        <label className={CLASE_ETIQUETA}>
          Proceso
          <select value={procesoId} onChange={(evento) => alElegirProceso(evento.target.value)} className={CLASE_CAMPO}>
            <option value="">Elige un proceso…</option>
            {destino.procesos.map((uno) => (
              <option key={uno.procesoId} value={uno.procesoId}>
                {uno.usuariaNombreCompleto} · {uno.codigo}
              </option>
            ))}
          </select>
        </label>
      )}

      {personas.length > 1 && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-gray-600">Persona que se atiende</legend>
          <div className="flex flex-wrap gap-2">
            {personas.map((persona) => {
              const elegida = persona.ninoId === ninoId
              return (
                <button
                  key={persona.ninoId ?? 'usuaria'}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => alCambiar(setNinoId)(persona.ninoId)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                    elegida
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {etiquetaPersona(persona)}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className={CLASE_ETIQUETA}>
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(evento) => alCambiar(setFecha)(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
        <label className={CLASE_ETIQUETA}>
          Hora
          <input
            type="time"
            value={hora}
            onChange={(evento) => alCambiar(setHora)(evento.target.value)}
            className={CLASE_CAMPO}
          />
        </label>
      </div>

      <label className={CLASE_ETIQUETA}>
        Duración
        <select
          value={duracion}
          onChange={(evento) => alCambiar(setDuracion)(Number(evento.target.value))}
          className={CLASE_CAMPO}
        >
          {DURACIONES_CITA_PSICOLOGICA_MINUTOS.map((minutos) => (
            <option key={minutos} value={minutos}>
              {minutos} minutos
            </option>
          ))}
        </select>
      </label>

      {conflicto && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">Ya tienes una cita a esa hora:</p>
          <ul className="mt-1 list-disc pl-4">
            {conflicto.map((cita) => (
              <li key={cita.id}>
                {formatInstanteGT(cita.fechaHora)} · {cita.duracionMinutos} min
              </li>
            ))}
          </ul>
          <p className="mt-1">Cambia la hora o confirma si es intencional.</p>
        </div>
      )}
    </ConfirmModal>
  )
}
