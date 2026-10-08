import { Link } from 'react-router-dom'
import {
  ETIQUETAS_ESTADO_CITA_PSICOLOGICA,
  ETIQUETAS_TIPO_CITA_PSICOLOGICA,
  minutosDelDiaGT,
  type CitaAgendaDto,
  type EstadoCitaPsicologica,
} from '@akyuam/shared'
import { horaDeMinutos } from '../compartido/horas'
import { RUTAS_PSICOLOGIA } from '../rutas'

const MINUTOS_DIA = 24 * 60
const CLASE_INSIGNIA = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'
const CLASES_ESTADO: Record<EstadoCitaPsicologica, string> = {
  PROGRAMADA: 'bg-brand-50 text-brand-700',
  ATENDIDA: 'bg-green-100 text-green-700',
  NO_ASISTIO: 'bg-gray-100 text-gray-600',
  CANCELADA: 'bg-gray-100 text-gray-600',
  REPROGRAMADA: 'bg-gray-100 text-gray-600',
}
const CLASE_SIN_REGISTRAR = 'bg-amber-50 text-amber-800'

const CLASE_BOTON = 'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold'
const CLASE_ENLACE = 'whitespace-nowrap text-sm font-medium text-brand-700 hover:underline'

interface FilaCitaProps {
  cita: CitaAgendaDto
  /** La cita cae en el día de hoy: solo entonces se puede registrar antes de que termine. */
  esHoy: boolean
  /** Es la que está en curso o la siguiente: la única con botón principal. */
  principal: boolean
  onNoAsistio: (cita: CitaAgendaDto) => void
  onReprogramar: (cita: CitaAgendaDto) => void
}

/** Una cita en la lista del día: a quién, cuándo, en qué quedó y lo que toca hacer con ella. */
export default function FilaCita({ cita, esHoy, principal, onNoAsistio, onReprogramar }: FilaCitaProps) {
  const inicioMin = minutosDelDiaGT(new Date(cita.fechaHora))
  const programada = cita.estado === 'PROGRAMADA'
  const registrable = programada && (esHoy || cita.sinRegistrar)

  let claseRegistrar = 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
  if (cita.sinRegistrar) claseRegistrar = 'border border-amber-400 bg-white text-amber-800 hover:bg-amber-50'
  else if (principal) claseRegistrar = 'bg-brand-600 text-white hover:bg-brand-700'

  let claseFila = ''
  if (cita.sinRegistrar) claseFila = 'bg-amber-50/40'
  else if (principal) claseFila = 'bg-brand-50/50'

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${claseFila}`}>
      <div className="w-12 flex-none font-mono text-xs leading-tight">
        <span className="block text-sm font-semibold text-gray-900">{horaDeMinutos(inicioMin)}</span>
        <span className="block text-gray-400">{horaDeMinutos((inicioMin + cita.duracionMinutos) % MINUTOS_DIA)}</span>
      </div>

      <div className="min-w-0 flex-1 basis-56">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">{cita.persona.nombreCompleto}</span>
          <span className={`${CLASE_INSIGNIA} ${cita.sinRegistrar ? CLASE_SIN_REGISTRAR : CLASES_ESTADO[cita.estado]}`}>
            {cita.sinRegistrar ? 'Sin registrar' : ETIQUETAS_ESTADO_CITA_PSICOLOGICA[cita.estado]}
          </span>
          {cita.borrador && programada && (
            <span className={`${CLASE_INSIGNIA} bg-gray-100 text-gray-600`}>Borrador guardado</span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {cita.persona.ninoId !== null && <>Hija/o de {cita.usuariaNombreCompleto} · </>}
          <span className="font-mono">{cita.procesoCodigo}</span> · {ETIQUETAS_TIPO_CITA_PSICOLOGICA[cita.tipo]} ·{' '}
          {cita.duracionMinutos} min
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {registrable && (
          <Link to={RUTAS_PSICOLOGIA.registrarConsulta(cita.id)} className={`${CLASE_BOTON} ${claseRegistrar}`}>
            {cita.borrador ? 'Continuar registro' : 'Registrar sesión'}
          </Link>
        )}
        {cita.sinRegistrar && (
          <button
            type="button"
            onClick={() => onNoAsistio(cita)}
            className={`${CLASE_BOTON} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}
          >
            Marcar no asistió
          </button>
        )}
        {programada ? (
          <button type="button" onClick={() => onReprogramar(cita)} className={CLASE_ENLACE}>
            Reprogramar
          </button>
        ) : (
          <Link
            to={
              cita.estado === 'ATENDIDA' || cita.estado === 'NO_ASISTIO'
                ? RUTAS_PSICOLOGIA.proceso(cita.procesoId, cita.id)
                : RUTAS_PSICOLOGIA.detalleCita(cita.id)
            }
            className={CLASE_ENLACE}
          >
            {cita.estado === 'ATENDIDA' ? 'Ver sesión' : 'Ver detalle'}
          </Link>
        )}
        <Link to={RUTAS_PSICOLOGIA.proceso(cita.procesoId)} className={CLASE_ENLACE}>
          Ver proceso
        </Link>
      </div>
    </li>
  )
}
