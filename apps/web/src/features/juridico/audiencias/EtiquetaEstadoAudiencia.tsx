import { AlertCircle, Ban, CalendarClock, CalendarDays, CheckCircle2, Repeat, XCircle, type LucideIcon } from 'lucide-react'
import { ETIQUETAS_ESTADO_VISIBLE_AUDIENCIA, type EstadoVisibleAudiencia } from '@akyuam/shared'

/** Texto + ícono + color (§8.1): ningún estado se distingue solo por el color. */
const ESTILO_ESTADO: Record<EstadoVisibleAudiencia, { Icono: LucideIcon; clases: string }> = {
  PROXIMA: { Icono: CalendarDays, clases: 'bg-[#e2ecf8] text-[#1f4f8a]' },
  HOY: { Icono: CalendarClock, clases: 'bg-[#f7f3fc] text-[#7346a5]' },
  PENDIENTE_RESULTADO: { Icono: AlertCircle, clases: 'bg-[#f6ecdc] text-[#8a5a14]' },
  REALIZADA: { Icono: CheckCircle2, clases: 'bg-[#e7f1ea] text-[#2f6b3f]' },
  NO_REALIZADA: { Icono: XCircle, clases: 'bg-[#f3e8e6] text-[#8a3a2c]' },
  CANCELADA: { Icono: Ban, clases: 'bg-[#eceef1] text-[#4a5360]' },
  REPROGRAMADA: { Icono: Repeat, clases: 'bg-[#eceef1] text-[#4a5360]' },
}

export default function EtiquetaEstadoAudiencia({ estado }: { estado: EstadoVisibleAudiencia }) {
  const { Icono, clases } = ESTILO_ESTADO[estado]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${clases}`}>
      <Icono size={13} aria-hidden="true" />
      {ETIQUETAS_ESTADO_VISIBLE_AUDIENCIA[estado]}
    </span>
  )
}
