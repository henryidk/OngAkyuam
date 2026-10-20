import { History } from 'lucide-react'

/**
 * Proceso que empezó en un año anterior y sigue abierto: "Seguimiento · 2024". Gris pizarra, a
 * propósito distinto del ámbar de las alertas: no es un problema, es cartera heredada.
 */
export default function ChipSeguimiento({ fechaInicio }: { fechaInicio: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
      <History size={12} aria-hidden="true" />
      Seguimiento · {fechaInicio.slice(0, 4)}
    </span>
  )
}
