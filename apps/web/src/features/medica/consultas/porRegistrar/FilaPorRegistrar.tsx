import { Link } from 'react-router-dom'
import type { CitaAgendaMedicaDto } from '@akyuam/shared'
import CodigoAtencion from '../../compartido/CodigoAtencion'
import EstadoCita from '../../compartido/EstadoCita'
import { fechaCorta } from '../../compartido/fechas'
import { detallePersonasCita } from '../../compartido/personas'
import { RUTAS_MEDICA } from '../../rutas'

interface FilaPorRegistrarProps {
  cita: CitaAgendaMedicaDto
  /** Atrasada: de otro día, se muestra la fecha además de la hora. */
  conFecha: boolean
  onNoAsistio: () => void
}

const BOTON_PRIMARIO =
  'whitespace-nowrap rounded-md bg-brand-600 px-[13px] py-2 text-[13px] font-semibold text-white hover:bg-brand-700'
const BOTON_NEUTRO =
  'whitespace-nowrap rounded-md border border-borde-fuerte bg-white px-3 py-[7px] text-[13px] font-medium text-texto hover:bg-superficie'
const ENLACE = 'whitespace-nowrap px-1.5 py-[7px] text-[13px] text-texto-suave underline underline-offset-2 hover:text-texto'

/**
 * Una cita por registrar: ya empezó, así que registrar es siempre la acción principal. "No
 * asistió" solo cuando la cita ya terminó.
 */
export default function FilaPorRegistrar({ cita, conFecha, onNoAsistio }: FilaPorRegistrarProps) {
  const estado = cita.estadoVista
  const enCurso = estado === 'EN_CURSO'
  const urlRegistrar = RUTAS_MEDICA.nuevaConsulta({ cita: cita.id, origen: 'consultas' })

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-borde-suave px-[18px] py-3.5 last:border-b-0 ${
        enCurso ? 'bg-brand-50' : 'bg-white'
      }`}
    >
      <div className="flex min-w-0 flex-[1_1_260px] items-center gap-4">
        <div className="flex w-[60px] flex-none flex-col gap-0.5">
          {conFecha && <span className="whitespace-nowrap text-[12px] font-medium text-estado-pendiente">{fechaCorta(cita.fecha)}</span>}
          <span className="whitespace-nowrap font-mono text-sm font-medium text-brand-600">{cita.hora}</span>
          {enCurso && (
            <span className="self-start rounded-[3px] bg-brand-600 px-[5px] py-px text-[10.5px] font-bold text-white">AHORA</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold text-texto">{cita.usuariaNombreCompleto}</span>
            <EstadoCita estado={estado} />
          </div>
          {detallePersonasCita(cita.personas) && (
            <span className="text-[12.5px] text-brand-600">{detallePersonasCita(cita.personas)}</span>
          )}
          <CodigoAtencion codigo={cita.codigoAtencion} />
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
        <Link to={urlRegistrar} aria-label={`Registrar consulta de ${cita.usuariaNombreCompleto}`} className={BOTON_PRIMARIO}>
          Registrar consulta
        </Link>
        {estado === 'SIN_REGISTRAR' && (
          <button
            type="button"
            onClick={onNoAsistio}
            aria-label={`Marcar que ${cita.usuariaNombreCompleto} no asistió`}
            className={BOTON_NEUTRO}
          >
            No asistió
          </button>
        )}
        <Link
          to={RUTAS_MEDICA.paciente(cita.usuariaId)}
          aria-label={`Ver ficha de ${cita.usuariaNombreCompleto}`}
          className={ENLACE}
        >
          Ver ficha
        </Link>
      </div>
    </div>
  )
}
