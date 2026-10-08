import axios from 'axios'
import { useRef, useState } from 'react'
import {
  CODIGO_TRASLAPE_CITA,
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  agendarCitaPsicologicaSchema,
  formatInstanteGT,
  type CasoPorAgendarDto,
  type CitaResumen,
  type ConflictoTraslapeCita,
  type ProcesoPsicologiaAbiertoDto,
} from '@akyuam/shared'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { extraerMensajeError } from '../../../lib/errors'
import { CLASE_CAMPO, CLASE_ETIQUETA } from '../../juridico/compartido/campos'
import { atenderReferencia } from '../api/psicologia.api'
import { etiquetaPersona } from '../compartido/personas'

interface ModalProgramarCitaProps {
  caso: CasoPorAgendarDto
  /** Día abierto en la agenda (`YYYY-MM-DD`): con él arranca el campo de fecha. */
  fechaInicial: string
  onCerrar: () => void
  /** `fecha` es el día de la cita, para que la agenda salte a él. */
  onAgendada: (proceso: ProcesoPsicologiaAbiertoDto, fecha: string) => void
}

/**
 * Primera cita de un caso tomado. Guardarla es lo que abre el proceso, por eso se pide solo lo
 * mínimo: a quién se atiende, cuándo y cuánto dura. El horario no se valida: si la psicóloga
 * agenda fuera de lo habitual, se asume que atiende.
 */
export default function ModalProgramarCita({ caso, fechaInicial, onCerrar, onAgendada }: ModalProgramarCitaProps) {
  const [ninoId, setNinoId] = useState<string | null>(caso.personas[0]?.ninoId ?? null)
  const [fecha, setFecha] = useState(fechaInicial)
  const [hora, setHora] = useState('')
  const [duracion, setDuracion] = useState<number>(DURACIONES_CITA_PSICOLOGICA_MINUTOS[0])
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Una clave por contenido: reintentar lo mismo (doble clic, red) no abre dos procesos, y
  // cambiar cualquier dato cuenta como un envío nuevo.
  const idempotencia = useRef<{ firma: string; clave: string } | null>(null)

  // El aviso de traslape era sobre la hora anterior: al tocar un dato deja de valer.
  function alCambiar<T>(asignar: (valor: T) => void) {
    return (valor: T) => {
      asignar(valor)
      setConflicto(null)
      setError(null)
    }
  }

  async function guardar() {
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

    const firma = JSON.stringify(validacion.data)
    if (idempotencia.current?.firma !== firma) {
      idempotencia.current = { firma, clave: crypto.randomUUID() }
    }

    setError(null)
    setGuardando(true)
    try {
      onAgendada(await atenderReferencia(caso.referidoId, validacion.data, idempotencia.current.clave), fecha)
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

  return (
    <ConfirmModal
      abierto
      titulo="Agendar primera cita"
      descripcion={`${caso.usuariaNombreCompleto} · Exp. ${caso.expedienteNumero} · referida por Trabajo Social`}
      confirmarLabel={conflicto ? 'Programar de todos modos' : 'Programar cita'}
      cargando={guardando}
      error={error}
      onConfirmar={() => void guardar()}
      onCancelar={onCerrar}
    >
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
        Al guardar se abre el proceso psicológico de la usuaria, en etapa Inicio.
      </p>

      {caso.personas.length > 1 && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-gray-600">Persona que se atiende</legend>
          <div className="flex flex-wrap gap-2">
            {caso.personas.map((persona) => {
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
