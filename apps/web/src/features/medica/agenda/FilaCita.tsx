import { Link } from 'react-router-dom'
import { hoyGT, type CitaAgendaMedicaDto } from '@akyuam/shared'
import CodigoAtencion from '../compartido/CodigoAtencion'
import EstadoCita from '../compartido/EstadoCita'
import { fechaLargaEnFrase } from '../compartido/fechas'
import { primerNombre } from '../compartido/personas'
import { RUTAS_MEDICA } from '../rutas'

interface FilaCitaProps {
  cita: CitaAgendaMedicaDto
  onNoAsistio: () => void
  onReprogramar: () => void
  onIrA: (fecha: string) => void
}

const BOTON_PRIMARIO =
  'whitespace-nowrap rounded-md bg-[#7346a5] px-[13px] py-2 text-[13px] font-semibold text-white hover:bg-[#5b3985]'
const BOTON_SECUNDARIO =
  'whitespace-nowrap rounded-md border border-[#d5dadf] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#7346a5] hover:border-[#7346a5]'
const BOTON_NEUTRO =
  'whitespace-nowrap rounded-md border border-[#d5dadf] bg-white px-3 py-[7px] text-[13px] font-medium text-[#1c2430] hover:bg-[#f8f9fa]'
const BOTON_BORDE_MORADO =
  'whitespace-nowrap rounded-md border border-[#7346a5] bg-white px-3 py-[7px] text-[13px] font-semibold text-[#7346a5] hover:bg-[#f7f3fc]'
const ENLACE = 'whitespace-nowrap px-1.5 py-[7px] text-[13px] underline underline-offset-2'

/**
 * Una cita del día. Las acciones dependen del estado que se ve: en curso o sin registrar se
 * registra (botón principal); programada para hoy, también se puede registrar; una inasistencia
 * se puede reprogramar si la paciente no tiene ya otra cita.
 */
export default function FilaCita({ cita, onNoAsistio, onReprogramar, onIrA }: FilaCitaProps) {
  const estado = cita.estadoVista
  const enCurso = estado === 'EN_CURSO'
  const registrarPrincipal = enCurso || estado === 'SIN_REGISTRAR'
  const registrarSecundario = estado === 'PROGRAMADA' && cita.fecha === hoyGT()
  const urlRegistrar = RUTAS_MEDICA.nuevaConsulta({ cita: cita.id, origen: 'agenda' })
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
        {registrarPrincipal && (
          <Link to={urlRegistrar} className={BOTON_PRIMARIO}>
            Registrar consulta
          </Link>
        )}
        {registrarSecundario && (
          <Link to={urlRegistrar} className={BOTON_SECUNDARIO}>
            Registrar consulta
          </Link>
        )}
        {estado === 'SIN_REGISTRAR' && (
          <button type="button" onClick={onNoAsistio} className={BOTON_NEUTRO}>
            No asistió
          </button>
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
