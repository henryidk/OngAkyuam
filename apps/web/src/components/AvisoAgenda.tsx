import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

interface AvisoAgendaProps {
  /** Lo que quedó sin registrar: tiene prioridad y es el único aviso en ámbar. */
  sinRegistrar: { total: number; texto: string; to: string } | null
  /** Explicación de un día no laboral; solo se ve si no hay nada sin registrar. */
  noLaboral: ReactNode | null
}

/**
 * Un solo aviso a la vez arriba de la Agenda (plan V2.3), en orden de prioridad: lo que quedó sin
 * registrar y, si no hay, el día no laboral. El texto dice el dato sin juzgar ("Sesiones por
 * registrar · 3"), y el enlace lleva a donde se resuelve.
 */
export default function AvisoAgenda({ sinRegistrar, noLaboral }: AvisoAgendaProps) {
  if (sinRegistrar && sinRegistrar.total > 0) {
    return (
      <Link
        to={sinRegistrar.to}
        className="flex w-fit items-center gap-1.5 rounded-md border border-estado-pendiente-borde bg-estado-pendiente-fondo px-3 py-2 text-[13.5px] font-medium text-estado-pendiente hover:underline hover:underline-offset-2"
      >
        {sinRegistrar.texto} · <span className="tabular-nums">{sinRegistrar.total}</span>
        <ArrowRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    )
  }
  if (!noLaboral) return null
  return <p className="w-fit rounded-md border border-borde bg-white px-3 py-2 text-[13.5px] text-texto-suave">{noLaboral}</p>
}
