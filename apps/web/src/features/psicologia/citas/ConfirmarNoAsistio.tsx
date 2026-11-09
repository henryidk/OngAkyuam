import axios from 'axios'
import { useState } from 'react'
import {
  CODIGO_TRASLAPE_CITA,
  DURACIONES_CITA_PSICOLOGICA_MINUTOS,
  DURACION_CITA_PSICOLOGICA_POR_DEFECTO,
  formatInstanteGT,
  hoyGT,
  moverCitaPsicologicaSchema,
  sumarDiasGT,
  type CitaResumen,
  type ConflictoTraslapeCita,
  type DuracionCitaPsicologica,
} from '@akyuam/shared'
import ModalPasos from '../../../components/agenda/ModalPasos'
import Button from '../../../components/ui/Button'
import { extraerMensajeError } from '../../../lib/errors'
import { marcarNoAsistio } from '../api/psicologia.api'
import { horaDeInstante } from '../compartido/horas'
import AvisoTraslape from './AvisoTraslape'
import ElegirHorario, { type HorarioElegido } from './ElegirHorario'

/** Lo mínimo para marcar una cita: cuál es, cómo nombrarla y de dónde proponer la nueva. */
export interface CitaPorMarcar {
  id: string
  /** "Nombre · 05-2026" o la fecha de la cita: lo que identifica a la cita en el aviso. */
  descripcion: string
  fechaHora: string
  /** La nueva cita dura lo mismo; si no se sabe, la duración habitual. */
  duracionMinutos?: number
  /**
   * Dar otra fecha es de quien lleva el proceso. `false` cuando se sabe que no es así (se ofrece
   * solo registrar la inasistencia); el servidor lo vuelve a comprobar igual.
   */
  puedeReprogramar?: boolean
}

interface ConfirmarNoAsistioProps {
  /** null = cerrado. */
  cita: CitaPorMarcar | null
  onCancelar: () => void
  /**
   * Se intentó marcar. Se avisa también si falló, porque lo más probable es que otra pestaña ya
   * la haya registrado y la pantalla deba refrescarse. Con `mensaje` ya se marcó y el modal
   * puede cerrarse; `fechaNueva` es el día de la cita nueva, si se reprogramó.
   */
  onIntento: (resultado: { mensaje: string; fechaNueva: string | null } | null) => void
}

function duracionDe(minutos: number | undefined): DuracionCitaPsicologica {
  return (DURACIONES_CITA_PSICOLOGICA_MINUTOS as readonly number[]).includes(minutos ?? 0)
    ? (minutos as DuracionCitaPsicologica)
    : DURACION_CITA_PSICOLOGICA_POR_DEFECTO
}

/**
 * "No asistió", el mismo en la agenda, en Por registrar y en el detalle del proceso (plan V3.3).
 * Por defecto propone la nueva cita en el mismo paso, como Medicina: marcar sin dar fecha es lo
 * que deja a una persona fuera de la agenda sin que nadie lo note. Todo o nada en el servidor.
 */
export default function ConfirmarNoAsistio({ cita, onCancelar, onIntento }: ConfirmarNoAsistioProps) {
  if (!cita) return null
  return <ModalNoAsistio key={cita.id} cita={cita} onCancelar={onCancelar} onIntento={onIntento} />
}

function ModalNoAsistio({ cita, onCancelar, onIntento }: ConfirmarNoAsistioProps & { cita: CitaPorMarcar }) {
  const puedeReprogramar = cita.puedeReprogramar !== false
  const [reprogramar, setReprogramar] = useState(puedeReprogramar)
  // Se propone desde mañana, a la misma hora; ElegirHorario corre a la siguiente libre.
  const [horario, setHorario] = useState<HorarioElegido>({
    fecha: sumarDiasGT(hoyGT(), 1),
    hora: horaDeInstante(cita.fechaHora),
  })
  const [duracion, setDuracion] = useState(() => duracionDe(cita.duracionMinutos))
  const [conflicto, setConflicto] = useState<CitaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // El aviso de traslape era sobre la hora anterior: al tocar un dato deja de valer.
  function limpiarAvisos() {
    setConflicto(null)
    setError(null)
  }

  async function guardar() {
    let datos = null
    if (reprogramar) {
      const validacion = moverCitaPsicologicaSchema.safeParse({
        fechaHora: `${horario.fecha}T${horario.hora}`,
        duracionMinutos: duracion,
        confirmarTraslape: conflicto !== null,
      })
      if (!horario.fecha || !horario.hora || !validacion.success) {
        setError('Elige el día y la hora de la nueva cita.')
        return
      }
      datos = validacion.data
    }
    setError(null)
    setGuardando(true)
    try {
      const resultado = await marcarNoAsistio(cita.id, { reprogramar: datos })
      onIntento(
        resultado.nuevaCita
          ? {
              mensaje: `Inasistencia registrada · nueva cita: ${formatInstanteGT(resultado.nuevaCita.fechaHora)}`,
              fechaNueva: horario.fecha,
            }
          : { mensaje: 'Inasistencia registrada', fechaNueva: null },
      )
    } catch (err) {
      const cuerpo = axios.isAxiosError(err) ? (err.response?.data as Partial<ConflictoTraslapeCita> | undefined) : undefined
      if (cuerpo?.codigo === CODIGO_TRASLAPE_CITA && cuerpo.detalle) {
        // No es un fallo: nada se escribió y la psicóloga decide si sigue.
        setConflicto(cuerpo.detalle.citas)
        return
      }
      setError(
        axios.isAxiosError(err) && err.response?.status === 403 && reprogramar
          ? 'Solo quien lleva el proceso puede darle otra fecha. Puedes registrar solo la inasistencia.'
          : extraerMensajeError(err),
      )
      onIntento(null)
    } finally {
      setGuardando(false)
    }
  }

  const opciones = [
    { valor: true, etiqueta: 'Dar otra fecha' },
    { valor: false, etiqueta: 'Solo registrar inasistencia' },
  ]
  let etiquetaBoton = 'Registrar inasistencia'
  if (reprogramar) etiquetaBoton = conflicto ? 'Registrar y agendar igual' : 'Registrar y agendar'

  return (
    <ModalPasos
      titulo="No asistió a la sesión"
      subtitulo={cita.descripcion}
      pie={
        <>
          <Button variante="secondary" tamano="md" onClick={onCancelar} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            tamano="md"
            onClick={() => void guardar()}
            disabled={reprogramar && (!horario.fecha || !horario.hora)}
            cargando={guardando}
          >
            {etiquetaBoton}
          </Button>
        </>
      }
    >
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[13px]">
        <p className="text-gray-500">Sesión a la que no asistió</p>
        <p className="font-medium text-gray-900 line-through decoration-gray-400">
          {formatInstanteGT(cita.fechaHora)}
        </p>
      </div>

      {puedeReprogramar && (
        <div role="radiogroup" aria-label="Qué hacer" className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          {opciones.map((opcion) => (
            <button
              key={String(opcion.valor)}
              type="button"
              role="radio"
              aria-checked={reprogramar === opcion.valor}
              onClick={() => {
                setReprogramar(opcion.valor)
                limpiarAvisos()
              }}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                reprogramar === opcion.valor ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      )}

      {reprogramar ? (
        <>
          <ElegirHorario
            fecha={horario.fecha}
            hora={horario.hora}
            duracion={duracion}
            onDuracion={(nueva) => {
              setDuracion(nueva)
              limpiarAvisos()
            }}
            onCambio={(nuevo) => {
              setHorario(nuevo)
              limpiarAvisos()
            }}
          />
          {conflicto && <AvisoTraslape citas={conflicto} accion="Cambia la hora o confirma si es intencional." />}
        </>
      ) : (
        <p className="rounded-lg bg-gray-50 px-3.5 py-2.5 text-[13px] text-gray-600">
          Se registra la inasistencia sin nueva cita. El proceso aparecerá en{' '}
          <strong className="font-semibold text-gray-900">Sin próxima cita</strong> para que lo agendes cuando la contactes.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </ModalPasos>
  )
}
