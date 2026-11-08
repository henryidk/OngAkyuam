import { Link } from 'react-router-dom'
import { citaRegistrableEnAgenda, type CitaAgendaMedicaDto } from '@akyuam/shared'
import CodigoAtencion from '../compartido/CodigoAtencion'
import EstadoCita from '../compartido/EstadoCita'
import { fechaLargaEnFrase } from '../compartido/fechas'
import { detallePersonasCita } from '../compartido/personas'
import { RUTAS_MEDICA } from '../rutas'

interface FilaCitaProps {
  cita: CitaAgendaMedicaDto
  onReprogramar: () => void
  onNoAsistio: () => void
  onIrA: (fecha: string) => void
}

const BOTON_PRIMARIO =
  'whitespace-nowrap rounded-md bg-brand-600 px-[13px] py-2 text-[13px] font-semibold text-white hover:bg-brand-700'
const BOTON_SECUNDARIO =
  'whitespace-nowrap rounded-md border border-borde-fuerte bg-white px-3 py-[7px] text-[13px] font-semibold text-brand-600 hover:border-brand-600'
const BOTON_NEUTRO =
  'whitespace-nowrap rounded-md border border-borde-fuerte bg-white px-3 py-[7px] text-[13px] font-medium text-texto hover:bg-superficie'

const BOTON_BORDE_MORADO =
  'whitespace-nowrap rounded-md border border-brand-600 bg-white px-3 py-[7px] text-[13px] font-semibold text-brand-600 hover:bg-brand-50'
const ENLACE = 'whitespace-nowrap px-1.5 py-[7px] text-[13px] underline underline-offset-2'

/**
 * Una cita del día. La consulta se registra desde aquí, donde la médica ve a la paciente, con la
 * regla compartida `citaRegistrableEnAgenda` (la misma de Psicología): lo que ya empezó (acción
 * principal) y lo de hoy que aún no empieza. Al guardar se vuelve a este día de la agenda.
 * "No asistió" solo cuando la cita ya pasó. "Reprogramar" mueve una cita que todavía no empieza,
 * o da nueva fecha a una inasistencia si la paciente no tiene ya otra cita.
 */
export default function FilaCita({ cita, onReprogramar, onNoAsistio, onIrA }: FilaCitaProps) {
  const estado = cita.estadoVista
  const enCurso = estado === 'EN_CURSO'
  const sinRegistrar = estado === 'SIN_REGISTRAR'
  const registrable = citaRegistrableEnAgenda({ programada: cita.estado === 'PROGRAMADA', inicio: cita.inicio }, new Date())
  const atendida = estado === 'ATENDIDA' && cita.consultaId !== null

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-borde-suave px-[18px] py-3.5 last:border-b-0 ${
        enCurso ? 'bg-brand-50' : 'bg-white'
      }`}
    >
      <div className="flex min-w-0 flex-[1_1_260px] items-center gap-4">
        <div className="flex w-[52px] flex-none flex-col gap-0.5">
          <span className="whitespace-nowrap font-mono text-sm font-medium text-brand-600">{cita.hora}</span>
          <span className="whitespace-nowrap font-mono text-[11.5px] text-texto-sutil">{cita.horaFin}</span>
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
          {cita.reprogramadaA && (
            <span className="flex items-center gap-1.5 text-[12.5px] text-brand-700">
              <span aria-hidden="true">↻</span>
              Reprogramada para {fechaLargaEnFrase(cita.reprogramadaA.fecha)} · {cita.reprogramadaA.hora}
            </span>
          )}
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
        {registrable && (
          <Link
            to={RUTAS_MEDICA.nuevaConsulta({ cita: cita.id, origen: 'agenda' })}
            className={enCurso || sinRegistrar ? BOTON_PRIMARIO : BOTON_SECUNDARIO}
          >
            Registrar consulta
          </Link>
        )}
        {sinRegistrar && (
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
          <button type="button" onClick={() => onIrA(cita.reprogramadaA!.fecha)} className={`${ENLACE} font-medium text-brand-600`}>
            Ver nueva cita
          </button>
        )}
        <Link
          to={atendida ? RUTAS_MEDICA.historia(cita.usuariaId, undefined, cita.consultaId!) : RUTAS_MEDICA.paciente(cita.usuariaId)}
          className={`${ENLACE} text-texto-suave hover:text-texto`}
        >
          {atendida ? 'Ver consulta' : 'Ver ficha'}
        </Link>
      </div>
    </div>
  )
}
