import { Paperclip } from 'lucide-react'
import {
  ETIQUETAS_CLINICA_PSICOLOGIA,
  fechaCalendarioGT,
  formatFechaGT,
  type FilaHistorialConsultaPsicologiaDto,
} from '@akyuam/shared'
import CodigoProceso from '../../compartido/CodigoProceso'
import { horaDeInstante } from '../../compartido/horas'
import { ETIQUETAS_ESTADO_HISTORIAL } from './etiquetas'

/** Una sesión del historial: solo metadatos. Las notas se ven al abrirla. */
export default function FilaHistorial({ sesion, onAbrir }: { sesion: FilaHistorialConsultaPsicologiaDto; onAbrir: () => void }) {
  const { persona } = sesion
  const atendida = sesion.estado === 'ATENDIDA'
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="grid w-full grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3.5 px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="flex flex-col">
          <span className="whitespace-nowrap text-sm font-semibold text-gray-900">
            {formatFechaGT(fechaCalendarioGT(new Date(sesion.fechaHora)))}
          </span>
          <span className="text-xs text-gray-500 tabular-nums">{horaDeInstante(sesion.fechaHora)}</span>
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-gray-900">{persona.nombreCompleto}</span>
          {persona.ninoId !== null && <span className="text-xs text-gray-500">Hijo/a de {sesion.usuariaNombreCompleto}</span>}
          <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-600">
            <CodigoProceso codigo={sesion.procesoCodigo} className="text-gray-600" />
            {sesion.clinica !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span>{ETIQUETAS_CLINICA_PSICOLOGIA[sesion.clinica]}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>Atendió: {sesion.propia ? 'Tú' : sesion.atendidoPor}</span>
            {sesion.tieneHoja && (
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true">·</span>
                <Paperclip aria-hidden="true" className="h-3.5 w-3.5" />
                Hoja de evolución
              </span>
            )}
          </span>
        </span>
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
            atendida ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {ETIQUETAS_ESTADO_HISTORIAL[sesion.estado]}
        </span>
      </button>
    </li>
  )
}
