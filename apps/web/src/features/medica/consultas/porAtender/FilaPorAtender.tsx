import { Link } from 'react-router-dom'
import type { CitaAgendaMedicaDto } from '@akyuam/shared'
import CodigoAtencion from '../../compartido/CodigoAtencion'
import EstadoCita from '../../compartido/EstadoCita'
import { fechaCorta } from '../../compartido/fechas'
import { primerNombre } from '../../compartido/personas'
import { RUTAS_MEDICA } from '../../rutas'

interface FilaPorAtenderProps {
  cita: CitaAgendaMedicaDto
  /** Atrasada: de otro día, se muestra la fecha además de la hora. */
  conFecha: boolean
  onNoAsistio: () => void
}

const BOTON_PRIMARIO =
  'whitespace-nowrap rounded-md bg-[#7346a5] px-[13px] py-2 text-[13px] font-semibold text-white hover:bg-[#5b3985]'
const BOTON_SECUNDARIO =
  'whitespace-nowrap rounded-md border border-[#d5dadf] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#7346a5] hover:border-[#7346a5]'
const BOTON_NEUTRO =
  'whitespace-nowrap rounded-md border border-[#d5dadf] bg-white px-3 py-[7px] text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa]'
const ENLACE = 'whitespace-nowrap px-1.5 py-[7px] text-[13px] text-[#5b6573] underline underline-offset-2 hover:text-[#1c2430]'

/**
 * Una cita por atender. En curso o sin registrar, registrar es la acción principal; programada
 * para más tarde hoy, también se puede registrar. "No asistió" solo cuando la cita ya pasó.
 */
export default function FilaPorAtender({ cita, conFecha, onNoAsistio }: FilaPorAtenderProps) {
  const estado = cita.estadoVista
  const enCurso = estado === 'EN_CURSO'
  const principal = enCurso || estado === 'SIN_REGISTRAR'
  const urlRegistrar = RUTAS_MEDICA.nuevaConsulta({ cita: cita.id, origen: 'consultas' })

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-[#eef0f2] px-[18px] py-3.5 last:border-b-0 ${
        enCurso ? 'bg-[#faf7fd]' : 'bg-white'
      }`}
    >
      <div className="flex min-w-0 flex-[1_1_260px] items-center gap-4">
        <div className="flex w-[60px] flex-none flex-col gap-0.5">
          {conFecha && <span className="whitespace-nowrap text-[12px] font-medium text-[#8a5a14]">{fechaCorta(cita.fecha)}</span>}
          <span className="whitespace-nowrap font-mono text-sm font-medium text-[#7346a5]">{cita.hora}</span>
          {enCurso && (
            <span className="self-start rounded-[3px] bg-[#7346a5] px-[5px] py-px text-[10.5px] font-bold text-white">AHORA</span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-semibold text-[#1c2430]">{cita.usuariaNombreCompleto}</span>
            <EstadoCita estado={estado} />
          </div>
          {cita.persona.ninoId && (
            <span className="text-[12.5px] text-[#7346a5]">
              Consulta de {primerNombre(cita.persona.nombreCompleto)} · {cita.persona.edad} años
            </span>
          )}
          <CodigoAtencion codigo={cita.codigoAtencion} />
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
        <Link to={urlRegistrar} className={principal ? BOTON_PRIMARIO : BOTON_SECUNDARIO}>
          Registrar consulta
        </Link>
        {estado === 'SIN_REGISTRAR' && (
          <button type="button" onClick={onNoAsistio} className={BOTON_NEUTRO}>
            No asistió
          </button>
        )}
        <Link to={RUTAS_MEDICA.paciente(cita.usuariaId)} className={ENLACE}>
          Ver ficha
        </Link>
      </div>
    </div>
  )
}
