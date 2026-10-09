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
import CodigoProceso from '../compartido/CodigoProceso'
import {
  BOTON_FILA_AMBAR,
  BOTON_FILA_BORDE,
  BOTON_FILA_RELLENO,
  CLASE_COLUMNA_HORA,
  ENLACE_FILA,
} from './estilos'

const MINUTOS_DIA = 24 * 60
const CLASE_ESTADO = 'whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-semibold'
const CLASES_ESTADO: Record<EstadoCitaPsicologica, string> = {
  PROGRAMADA: 'bg-brand-50 text-brand-700',
  ATENDIDA: 'bg-green-50 text-green-800',
  NO_ASISTIO: 'bg-gray-100 text-gray-600',
  CANCELADA: 'bg-gray-100 text-gray-600',
  REPROGRAMADA: 'bg-gray-100 text-gray-600',
}
const CLASE_SIN_REGISTRAR = 'bg-amber-50 text-amber-800'

interface FilaCitaProps {
  cita: CitaAgendaDto
  /** La cita cae en el día de hoy: solo entonces se puede registrar antes de que termine. */
  esHoy: boolean
  /** Es la que está en curso o la siguiente: la única con botón principal. */
  principal: boolean
  /** La principal ya empezó ("Ahora") o todavía no ("Sigue"). */
  enCurso: boolean
  onNoAsistio: (cita: CitaAgendaDto) => void
  onReprogramar: (cita: CitaAgendaDto) => void
}

/** Una cita en la lista del día: a quién, cuándo, en qué quedó y lo que toca hacer con ella. */
export default function FilaCita({ cita, esHoy, principal, enCurso, onNoAsistio, onReprogramar }: FilaCitaProps) {
  const inicioMin = minutosDelDiaGT(new Date(cita.fechaHora))
  const programada = cita.estado === 'PROGRAMADA'
  const registrable = programada && (esHoy || cita.sinRegistrar)

  let claseRegistrar = BOTON_FILA_BORDE
  if (cita.sinRegistrar) claseRegistrar = BOTON_FILA_AMBAR
  else if (principal) claseRegistrar = BOTON_FILA_RELLENO

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-[18px] py-3.5 ${principal ? 'bg-brand-50/60' : ''}`}>
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
        <div className={`${CLASE_COLUMNA_HORA} flex flex-col items-start gap-0.5`}>
          <span className="text-sm font-medium text-brand-600">{horaDeMinutos(inicioMin)}</span>
          <span className="text-[11.5px] text-gray-400">
            {horaDeMinutos((inicioMin + cita.duracionMinutos) % MINUTOS_DIA)}
          </span>
          {principal && (
            <span className="rounded-[3px] bg-brand-600 px-1.5 py-px font-sans text-[10.5px] font-bold uppercase text-white">
              {enCurso ? 'Ahora' : 'Sigue'}
            </span>
          )}
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[14.5px] font-semibold text-gray-900">{cita.persona.nombreCompleto}</span>
            <span className={`${CLASE_ESTADO} ${cita.sinRegistrar ? CLASE_SIN_REGISTRAR : CLASES_ESTADO[cita.estado]}`}>
              {cita.sinRegistrar ? 'Sin registrar' : ETIQUETAS_ESTADO_CITA_PSICOLOGICA[cita.estado]}
            </span>
            {cita.borrador && programada && (
              <span className={`${CLASE_ESTADO} bg-gray-100 text-gray-600`}>Borrador guardado</span>
            )}
          </div>
          {cita.persona.ninoId !== null && (
            <p className="truncate text-[12.5px] text-brand-600">Hija/o de {cita.usuariaNombreCompleto}</p>
          )}
          <p className="truncate text-[12.5px] text-gray-500">
            <CodigoProceso codigo={cita.procesoCodigo} className="text-gray-600" /> ·{' '}
            {ETIQUETAS_TIPO_CITA_PSICOLOGICA[cita.tipo]}
          </p>
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
        {registrable && (
          <Link to={RUTAS_PSICOLOGIA.registrarConsulta(cita.id)} className={claseRegistrar}>
            {cita.borrador ? 'Continuar registro' : 'Registrar sesión'}
          </Link>
        )}
        {cita.sinRegistrar && (
          <button
            type="button"
            onClick={() => onNoAsistio(cita)}
            aria-label={`Marcar que ${cita.persona.nombreCompleto} no asistió`}
            className={BOTON_FILA_BORDE}
          >
            No asistió
          </button>
        )}
        {programada ? (
          <button type="button" onClick={() => onReprogramar(cita)} className={`${ENLACE_FILA} text-gray-500 hover:text-gray-800`}>
            Reprogramar
          </button>
        ) : (
          <Link
            to={
              cita.estado === 'ATENDIDA' || cita.estado === 'NO_ASISTIO'
                ? RUTAS_PSICOLOGIA.proceso(cita.procesoId, cita.id)
                : RUTAS_PSICOLOGIA.detalleCita(cita.id)
            }
            className={`${ENLACE_FILA} text-gray-500 hover:text-gray-800`}
          >
            {cita.estado === 'ATENDIDA' ? 'Ver sesión' : 'Ver detalle'}
          </Link>
        )}
        <Link
          to={RUTAS_PSICOLOGIA.proceso(cita.procesoId)}
          className={`${ENLACE_FILA} font-medium text-brand-700 hover:text-brand-900`}
        >
          Ver proceso
        </Link>
      </div>
    </li>
  )
}
