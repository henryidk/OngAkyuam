import { Link } from 'react-router-dom'
import {
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_MODALIDAD_CITA,
  formatInstanteGT,
  type CitaResumen,
  type EstadoCitaPsicologica,
} from '@akyuam/shared'
import Badge, { type BadgeTono } from '../../../components/ui/Badge'

const TONO_ESTADO: Record<EstadoCitaPsicologica, BadgeTono> = {
  PROGRAMADA: 'neutral',
  ATENDIDA: 'success',
  CANCELADA: 'danger',
  NO_ASISTIO: 'warning',
  REPROGRAMADA: 'neutral',
}

interface FilaCitaProps {
  cita: CitaResumen
  /** Nombre de la usuaria — se muestra solo cuando la fila no está ya en el contexto de un expediente puntual (tablero, agenda). */
  usuariaNombreCompleto?: string
  /** Requerido para los links de "Ver expediente"/"Reprogramar". */
  expedienteId?: string
  /** Historial de citas: toda la fila navega al detalle de la cita. */
  enlazarDetalleCita?: boolean
  mostrarRegistrarConsulta?: boolean
  mostrarVerExpediente?: boolean
  mostrarReprogramar?: boolean
}

/**
 * Fila de cita reusada por tablero, agenda (vista día) e historial de citas — qué acciones
 * muestra se decide por props, nunca por un `if` de "en qué pantalla estoy" (§8.3 del plan).
 */
export default function FilaCita({
  cita,
  usuariaNombreCompleto,
  expedienteId,
  enlazarDetalleCita = false,
  mostrarRegistrarConsulta = false,
  mostrarVerExpediente = false,
  mostrarReprogramar = false,
}: FilaCitaProps) {
  const contenido = (
    <div className="flex flex-wrap items-center gap-3">
      <span className="font-medium text-gray-800">{formatInstanteGT(cita.fechaHora)}</span>
      {usuariaNombreCompleto && <span className="font-medium text-gray-800">{usuariaNombreCompleto}</span>}
      <span className="text-gray-500">{cita.motivo}</span>
      <span className="text-xs text-gray-500">{ETIQUETAS_MODALIDAD_CITA[cita.modalidad]}</span>
      <Badge tono={TONO_ESTADO[cita.estado]}>{ETIQUETAS_ESTADO_CITA_PSICOLOGICA[cita.estado]}</Badge>
    </div>
  )

  const hayAcciones =
    mostrarRegistrarConsulta || (mostrarVerExpediente && expedienteId) || (mostrarReprogramar && expedienteId)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
      {enlazarDetalleCita ? (
        <Link to={`/psicologia/citas/${cita.id}`} className="min-w-0 flex-1 hover:underline">
          {contenido}
        </Link>
      ) : (
        contenido
      )}

      {hayAcciones && (
        <div className="flex flex-wrap items-center gap-3">
          {mostrarRegistrarConsulta && (
            <Link
              to={`/psicologia/citas/${cita.id}/atencion`}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Registrar consulta
            </Link>
          )}
          {mostrarVerExpediente && expedienteId && (
            <Link
              to={`/psicologia/expedientes/${expedienteId}`}
              className="text-xs font-medium text-gray-600 hover:underline"
            >
              Ver expediente
            </Link>
          )}
          {mostrarReprogramar && expedienteId && (
            <Link
              to={`/psicologia/expedientes/${expedienteId}/citas/nueva?reprograma=${cita.id}`}
              className="text-xs font-medium text-gray-600 hover:underline"
            >
              Reprogramar
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
