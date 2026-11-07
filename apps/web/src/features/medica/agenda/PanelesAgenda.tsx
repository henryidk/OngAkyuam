import { useState, type ReactNode } from 'react'
import { CalendarX2, CircleAlert, CircleCheck, Clock, UserX } from 'lucide-react'
import {
  MESES_SIN_VENIR_MEDICA,
  anioActualGT,
  diasDesdeFechaGT,
  dejoDeVenirMedica,
  formatFechaGT,
  hoyGT,
  type SinProximaConsultaDto,
} from '@akyuam/shared'
import CodigoAtencion from '../compartido/CodigoAtencion'
import { anioDe, fechaCorta } from '../compartido/fechas'

const BOTON_AGENDAR =
  'whitespace-nowrap rounded-md border border-[#7346a5] bg-white px-2.5 py-1.5 text-[12.5px] font-semibold text-[#7346a5] hover:bg-[#f7f3fc]'
const BOTON_ALTA =
  'whitespace-nowrap rounded-md border border-[#d5dadf] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-[#1c2430] hover:bg-[#f8f9fa]'

/** Cuántas del grupo "sin venir" se ven antes de "Ver todas": los demás grupos se ven completos. */
const VISIBLES_SIN_VENIR = 3

/** "hoy", "ayer", "hace 5 días", "hace 3 semanas", "hace 4 meses", "hace más de un año". */
function haceCuanto(fecha: string): string {
  const dias = diasDesdeFechaGT(fecha)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 14) return `hace ${dias} días`
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`
  if (dias < 365) return `hace ${Math.floor(dias / 30)} meses`
  return dias < 730 ? 'hace más de un año' : `hace más de ${Math.floor(dias / 365)} años`
}

/** "30 oct" en el año en curso; "30/10/2025" si es de otro año. */
function fechaBreve(fecha: string): string {
  return anioDe(fecha) === anioActualGT() ? fechaCorta(fecha) : formatFechaGT(fecha)
}

/** Lo que pasó la última vez, en palabras: no hay que restar fechas para entenderlo. */
function QueFue({ paciente }: { paciente: SinProximaConsultaDto }) {
  return (
    <span className="text-xs text-[#5b6573]">
      {paciente.motivo === 'NO_ASISTIO' ? 'Faltó' : 'Última consulta'}{' '}
      <span className="whitespace-nowrap">{haceCuanto(paciente.desde)}</span>{' '}
      <span className="whitespace-nowrap">· {fechaBreve(paciente.desde)}</span>
    </span>
  )
}

interface GrupoProps {
  icono: ReactNode
  titulo: string
  total: number
  ayuda?: string
  children: ReactNode
}

function Grupo({ icono, titulo, total, ayuda, children }: GrupoProps) {
  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-0.5 pb-1.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1c2430]">
          {icono}
          {titulo}
          <span className="font-mono text-[12px] font-medium text-[#5b6573]">{total}</span>
        </h3>
        {ayuda && <p className="text-[12px] text-[#5b6573]">{ayuda}</p>}
      </div>
      <ul className="flex flex-col">{children}</ul>
    </div>
  )
}

function Fila({ paciente, children }: { paciente: SinProximaConsultaDto; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-[#eef0f2] py-2">
      <div className="flex min-w-0 flex-[1_1_150px] flex-col gap-0.5">
        <span className="text-[13px] font-medium text-[#1c2430]">{paciente.usuariaNombreCompleto}</span>
        <QueFue paciente={paciente} />
        <CodigoAtencion codigo={paciente.codigoAtencion} />
      </div>
      <div className="flex gap-1.5">{children}</div>
    </li>
  )
}

interface PanelesAgendaProps {
  sinProxima: SinProximaConsultaDto[]
  onAgendarPaciente: (usuariaId: string) => void
  onDarDeAlta: (paciente: SinProximaConsultaDto) => void
}

/**
 * Columna derecha de la Agenda: pacientes en atención activa sin próxima consulta, todas, de la
 * más reciente a la más antigua dentro de cada grupo, porque la más reciente es la que todavía se
 * recupera con una llamada. Tres grupos, cada uno con su acción:
 * - No asistió: faltó y nadie le dio otra fecha.
 * - Atendidas sin fecha: se le dio consulta pero no se agendó la siguiente.
 * - Sin venir hace más de 2 meses (falte o no): probablemente ya no sigue; se agenda o se da de
 *   alta, para que la lista no crezca con pacientes que ya no vienen.
 * Las referencias por agendar están en el Área de atención y las citas sin registrar, en Consultas.
 */
export default function PanelesAgenda({ sinProxima, onAgendarPaciente, onDarDeAlta }: PanelesAgendaProps) {
  const [verTodasSinVenir, setVerTodasSinVenir] = useState(false)
  const hoy = hoyGT()
  const sinVenir = sinProxima.filter((p) => dejoDeVenirMedica(p.desde, hoy))
  const recientes = sinProxima.filter((p) => !dejoDeVenirMedica(p.desde, hoy))
  const faltaron = recientes.filter((p) => p.motivo === 'NO_ASISTIO')
  const sinFecha = recientes.filter((p) => p.motivo === 'SIN_FECHA')
  const sinVenirVisibles = verTodasSinVenir ? sinVenir : sinVenir.slice(0, VISIBLES_SIN_VENIR)
  const hayPendientes = sinProxima.length > 0

  const agendar = (paciente: SinProximaConsultaDto) => (
    <button type="button" onClick={() => onAgendarPaciente(paciente.usuariaId)} className={BOTON_AGENDAR}>
      Agendar
    </button>
  )

  return (
    <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
      <section
        aria-labelledby="titulo-sin-proxima"
        className={`flex flex-col overflow-hidden rounded-lg border bg-white ${hayPendientes ? 'border-[#e8cf9f]' : 'border-[#e3e6ea]'}`}
      >
        <header className={`flex items-start gap-2.5 px-4 py-3 ${hayPendientes ? 'bg-[#fdf6e9]' : ''}`}>
          {hayPendientes ? (
            <CircleAlert aria-hidden="true" className="mt-px h-[18px] w-[18px] flex-none text-[#a15c07]" />
          ) : (
            <CircleCheck aria-hidden="true" className="mt-px h-[18px] w-[18px] flex-none text-[#2f7d4f]" />
          )}
          <div className="flex flex-col gap-0.5">
            <h2 id="titulo-sin-proxima" className="text-sm font-semibold text-[#1c2430]">
              {hayPendientes
                ? `${sinProxima.length} ${sinProxima.length === 1 ? 'paciente sin próxima consulta' : 'pacientes sin próxima consulta'}`
                : 'Todas tus pacientes en atención tienen fecha'}
            </h2>
            <p className="text-[12.5px] text-[#5b6573]">
              {hayPendientes
                ? 'Siguen en atención pero no tienen cita. Que ninguna se quede sin fecha.'
                : 'Cuando una paciente en atención se quede sin cita, aparecerá aquí.'}
            </p>
          </div>
        </header>

        {hayPendientes && (
          <div className="flex flex-col gap-4 px-4 pb-3 pt-3">
            {faltaron.length > 0 && (
              <Grupo icono={<UserX aria-hidden="true" className="h-4 w-4 text-[#a15c07]" />} titulo="No asistió" total={faltaron.length}>
                {faltaron.map((p) => (
                  <Fila key={p.atencionId} paciente={p}>
                    {agendar(p)}
                  </Fila>
                ))}
              </Grupo>
            )}
            {sinFecha.length > 0 && (
              <Grupo
                icono={<CalendarX2 aria-hidden="true" className="h-4 w-4 text-[#7346a5]" />}
                titulo="Atendidas sin siguiente fecha"
                total={sinFecha.length}
              >
                {sinFecha.map((p) => (
                  <Fila key={p.atencionId} paciente={p}>
                    {agendar(p)}
                  </Fila>
                ))}
              </Grupo>
            )}
            {sinVenir.length > 0 && (
              <Grupo
                icono={<Clock aria-hidden="true" className="h-4 w-4 text-[#5b6573]" />}
                titulo={`Sin venir hace más de ${MESES_SIN_VENIR_MEDICA} meses`}
                total={sinVenir.length}
                ayuda="¿Sigue en atención? Agéndala o dale de alta."
              >
                {sinVenirVisibles.map((p) => (
                  <Fila key={p.atencionId} paciente={p}>
                    {agendar(p)}
                    <button type="button" onClick={() => onDarDeAlta(p)} className={BOTON_ALTA}>
                      Dar de alta
                    </button>
                  </Fila>
                ))}
                {sinVenir.length > VISIBLES_SIN_VENIR && (
                  <li className="border-t border-[#eef0f2] pt-2">
                    <button
                      type="button"
                      aria-expanded={verTodasSinVenir}
                      onClick={() => setVerTodasSinVenir((v) => !v)}
                      className="text-[12.5px] font-medium text-[#7346a5] underline underline-offset-2"
                    >
                      {verTodasSinVenir ? 'Ver menos' : `Ver las ${sinVenir.length} pacientes`}
                    </button>
                  </li>
                )}
              </Grupo>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
