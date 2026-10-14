import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  diasDesdeGT,
  formatFechaGT,
  type CitaAgendaMedicaDto,
  type PendientePrimeraConsultaDto,
  type SinProximaConsultaDto,
} from '@akyuam/shared'
import { fechaDeInstante } from '../../../lib/formato'
import { fechaCorta } from '../compartido/fechas'
import { primerNombre } from '../compartido/personas'
import { RUTAS_MEDICA } from '../rutas'

interface PanelProps {
  titulo: string
  descripcion: string
  borde: string
  colorTitulo?: string
  children: ReactNode
}

function Panel({ titulo, descripcion, borde, colorTitulo = 'text-[#1c2430]', children }: PanelProps) {
  return (
    <section className={`flex flex-col gap-2.5 rounded-lg border bg-white p-4 ${borde}`}>
      <div className="flex flex-col gap-0.5">
        <h2 className={`text-sm font-semibold ${colorTitulo}`}>{titulo}</h2>
        <p className="text-[12.5px] text-[#5b6573]">{descripcion}</p>
      </div>
      {children}
    </section>
  )
}

function Fila({ nombre, detalle, resaltada = false, children }: { nombre: string; detalle: string; resaltada?: boolean; children: ReactNode }) {
  return (
    <div
      className={`-mx-2 flex flex-wrap items-center justify-between gap-2.5 rounded-md border-t border-[#eef0f2] p-2 ${
        resaltada ? 'bg-[#f7f3fc]' : ''
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-[#1c2430]">{nombre}</span>
        <span className="text-xs text-[#5b6573]">{detalle}</span>
      </div>
      <div className="flex gap-1.5">{children}</div>
    </div>
  )
}

const BOTON_CHICO = 'whitespace-nowrap rounded-md border bg-white px-2.5 py-1.5 text-[12.5px]'

interface PanelesAgendaProps {
  pendientes: PendientePrimeraConsultaDto[]
  sinRegistrar: CitaAgendaMedicaDto[]
  sinProxima: SinProximaConsultaDto[]
  /** Referencia recién llegada desde el Área de atención: se resalta. */
  referidoResaltado: string | null
  onAgendarPendiente: (referidoId: string) => void
  onAgendarPaciente: (usuariaId: string) => void
  onNoAsistio: (cita: CitaAgendaMedicaDto) => void
}

/** Columna derecha de la Agenda: lo que pide acción fuera de las citas del día abierto. */
export default function PanelesAgenda({
  pendientes,
  sinRegistrar,
  sinProxima,
  referidoResaltado,
  onAgendarPendiente,
  onAgendarPaciente,
  onNoAsistio,
}: PanelesAgendaProps) {
  return (
    <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
      {pendientes.length > 0 && (
        <Panel
          titulo={`Pendientes de primera consulta · ${pendientes.length}`}
          descripcion="Al programar la primera consulta se abre la atención médica."
          borde="border-[#dcc9f0]"
          colorTitulo="text-[#5b3985]"
        >
          {pendientes.map((pendiente) => (
            <Fila
              key={pendiente.referidoId}
              nombre={pendiente.usuariaNombreCompleto}
              detalle={`Exp. ${pendiente.expedienteNumero} · referida ${
                diasDesdeGT(pendiente.referidoEn) === 0 ? 'hoy' : fechaDeInstante(pendiente.referidoEn)
              }`}
              resaltada={pendiente.referidoId === referidoResaltado}
            >
              <button
                type="button"
                onClick={() => onAgendarPendiente(pendiente.referidoId)}
                className={`${BOTON_CHICO} border-[#7346a5] font-semibold text-[#7346a5] hover:bg-[#f7f3fc]`}
              >
                Agendar
              </button>
            </Fila>
          ))}
        </Panel>
      )}

      {sinRegistrar.length > 0 && (
        <Panel
          titulo={`Consultas sin registrar · ${sinRegistrar.length}`}
          descripcion="De otros días: ya pasaron y no tienen consulta ni inasistencia."
          borde="border-[#ecd9b8]"
          colorTitulo="text-[#8a5a14]"
        >
          {sinRegistrar.map((cita) => (
            <Fila
              key={cita.id}
              nombre={cita.usuariaNombreCompleto}
              detalle={`${fechaCorta(cita.fecha)} · ${cita.hora}${cita.persona.ninoId ? ` · ${primerNombre(cita.persona.nombreCompleto)}` : ''}`}
            >
              <Link
                to={RUTAS_MEDICA.nuevaConsulta({ cita: cita.id, origen: 'agenda' })}
                className={`${BOTON_CHICO} border-[#d08a1f] font-semibold text-[#8a5a14] hover:bg-[#fbf1de]`}
              >
                Registrar
              </Link>
              <button
                type="button"
                onClick={() => onNoAsistio(cita)}
                className={`${BOTON_CHICO} border-[#d5dadf] font-medium text-[#1c2430] hover:bg-[#f8f9fa]`}
              >
                No asistió
              </button>
            </Fila>
          ))}
        </Panel>
      )}

      <Panel
        titulo={`Sin próxima consulta · ${sinProxima.length}`}
        descripcion="Pacientes en atención sin siguiente fecha."
        borde="border-[#e3e6ea]"
      >
        {sinProxima.length === 0 ? (
          <p className="text-[13px] text-[#5b6573]">Todas tus pacientes en atención tienen consulta programada.</p>
        ) : (
          sinProxima.map((paciente) => (
            <Fila
              key={paciente.atencionId}
              nombre={paciente.usuariaNombreCompleto}
              detalle={`${paciente.codigoAtencion} · última consulta ${paciente.ultimaConsulta ? formatFechaGT(paciente.ultimaConsulta) : '—'}`}
            >
              <button
                type="button"
                onClick={() => onAgendarPaciente(paciente.usuariaId)}
                className={`${BOTON_CHICO} border-[#d5dadf] font-semibold text-[#7346a5] hover:border-[#7346a5]`}
              >
                Agendar
              </button>
            </Fila>
          ))
        )}
      </Panel>
    </div>
  )
}
