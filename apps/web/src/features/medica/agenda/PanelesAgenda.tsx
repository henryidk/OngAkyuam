import type { ReactNode } from 'react'
import { formatFechaGT, type SinProximaConsultaDto } from '@akyuam/shared'

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

function Fila({ nombre, detalle, children }: { nombre: string; detalle: string; children: ReactNode }) {
  return (
    <div className="-mx-2 flex flex-wrap items-center justify-between gap-2.5 rounded-md border-t border-[#eef0f2] p-2">
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
  sinProxima: SinProximaConsultaDto[]
  onAgendarPaciente: (usuariaId: string) => void
}

/**
 * Columna derecha de la Agenda: pacientes en atención sin próxima consulta. Las referencias por
 * agendar están en el Área de atención y las citas sin registrar, en Consultas.
 */
export default function PanelesAgenda({ sinProxima, onAgendarPaciente }: PanelesAgendaProps) {
  return (
    <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
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
