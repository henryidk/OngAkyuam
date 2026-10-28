import { Link } from 'react-router-dom'
import type { CitaAgendaMedicaDto } from '@akyuam/shared'
import CodigoAtencion from '../compartido/CodigoAtencion'
import EstadoCita from '../compartido/EstadoCita'
import { fechaLargaEnFrase } from '../compartido/fechas'
import { primerNombre } from '../compartido/personas'
import { RUTAS_MEDICA } from '../rutas'

interface FilaCitaProps {
  cita: CitaAgendaMedicaDto
  onReprogramar: () => void
  onIrA: (fecha: string) => void
}

const BOTON_BORDE_MORADO =
  'whitespace-nowrap rounded-md border border-[#7346a5] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#7346a5] hover:bg-[#f7f3fc]'
const ENLACE = 'whitespace-nowrap px-1.5 py-[7px] text-[13px] underline underline-offset-2'

/**
 * Una cita del día. Registrar la consulta o la inasistencia se hace en Consultas: aquí una cita en
 * curso o sin registrar solo lleva hasta allá. Una inasistencia se puede reprogramar si la
 * paciente no tiene ya otra cita.
 */
export default function FilaCita({ cita, onReprogramar, onIrA }: FilaCitaProps) {
  const estado = cita.estadoVista
  const enCurso = estado === 'EN_CURSO'
  const pideRegistro = enCurso || estado === 'SIN_REGISTRAR'
  const atendida = estado === 'ATENDIDA' && cita.consultaId !== null

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-[#eef0f2] px-[18px] py-3.5 last:border-b-0 ${
        enCurso ? 'bg-[#faf7fd]' : 'bg-white'
      }`}
    >
      <div className="flex min-w-0 flex-[1_1_260px] items-center gap-4">
        <div className="flex w-[52px] flex-none flex-col gap-0.5">
          <span className="whitespace-nowrap font-mono text-sm font-medium text-[#7346a5]">{cita.hora}</span>
          <span className="whitespace-nowrap font-mono text-[11.5px] text-[#9aa4b0]">{cita.horaFin}</span>
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
          {cita.reprogramadaA && (
            <span className="flex items-center gap-1.5 text-[12.5px] text-[#5b3985]">
              <span aria-hidden="true">↻</span>
              Reprogramada para {fechaLargaEnFrase(cita.reprogramadaA.fecha)} · {cita.reprogramadaA.hora}
            </span>
          )}
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
        {pideRegistro && (
          <Link to={RUTAS_MEDICA.consultas()} className={`${ENLACE} font-medium text-[#7346a5]`}>
            Ir a consultas
          </Link>
        )}
        {cita.puedeReprogramar && (
          <button type="button" onClick={onReprogramar} className={BOTON_BORDE_MORADO}>
            Reprogramar
          </button>
        )}
        {cita.reprogramadaA && (
          <button type="button" onClick={() => onIrA(cita.reprogramadaA!.fecha)} className={`${ENLACE} font-medium text-[#7346a5]`}>
            Ver nueva cita
          </button>
        )}
        <Link
          to={atendida ? RUTAS_MEDICA.historia(cita.usuariaId, undefined, cita.consultaId!) : RUTAS_MEDICA.paciente(cita.usuariaId)}
          className={`${ENLACE} text-[#5b6573] hover:text-[#1c2430]`}
        >
          {atendida ? 'Ver consulta' : 'Ver ficha'}
        </Link>
      </div>
    </div>
  )
}
