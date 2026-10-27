import { Link } from 'react-router-dom'
import { ETIQUETAS_TIPO_CITA_PSICOLOGICA, formatFechaGT, fechaCalendarioGT, type SesionPorRegistrarDto } from '@akyuam/shared'
import { BOTON_FILA_BORDE, BOTON_FILA_RELLENO, CLASE_COLUMNA_HORA } from '../../agenda/estilos'
import CodigoProceso from '../../compartido/CodigoProceso'
import { horaDeInstante } from '../../compartido/horas'
import { RUTAS_PSICOLOGIA } from '../../rutas'
import { textoAtraso } from './grupos'

interface FilaPorRegistrarProps {
  sesion: SesionPorRegistrarDto
  /** Días de atraso; null = es de hoy. */
  atraso: number | null
  onNoAsistio: (sesion: SesionPorRegistrarDto) => void
}

/** Una sesión mía sin registrar: Registrar es la acción principal; No asistió, la alternativa. */
export default function FilaPorRegistrar({ sesion, atraso, onNoAsistio }: FilaPorRegistrarProps) {
  const { persona } = sesion
  const esHijo = persona.ninoId !== null
  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${atraso !== null ? 'border-l-4 border-l-amber-400' : ''}`}>
      <div className={`${CLASE_COLUMNA_HORA} text-sm font-semibold text-gray-900 tabular-nums`}>
        {horaDeInstante(sesion.fechaHora)}
      </div>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold text-gray-900">{persona.nombreCompleto}</p>
        {esHijo && <p className="text-xs text-gray-500">Hijo/a de {sesion.usuariaNombreCompleto}</p>}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-gray-600">
          <CodigoProceso codigo={sesion.procesoCodigo} className="text-gray-600" />
          <span aria-hidden="true">·</span>
          <span>{ETIQUETAS_TIPO_CITA_PSICOLOGICA[sesion.tipo]}</span>
          {atraso !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-amber-800">
                {formatFechaGT(fechaCalendarioGT(new Date(sesion.fechaHora)))}, {textoAtraso(atraso)}
              </span>
            </>
          )}
          {sesion.borrador && (
            <>
              <span aria-hidden="true">·</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">Borrador guardado</span>
            </>
          )}
        </p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <Link
          to={RUTAS_PSICOLOGIA.registrarConsulta(sesion.citaId)}
          aria-label={`${sesion.borrador ? 'Continuar registro' : 'Registrar sesión'} de ${persona.nombreCompleto}`}
          className={BOTON_FILA_RELLENO}
        >
          {sesion.borrador ? 'Continuar' : 'Registrar'}
        </Link>
        <button
          type="button"
          onClick={() => onNoAsistio(sesion)}
          aria-label={`Marcar que ${persona.nombreCompleto} no asistió`}
          className={BOTON_FILA_BORDE}
        >
          No asistió
        </button>
      </div>
    </li>
  )
}
