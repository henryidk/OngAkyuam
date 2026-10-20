import { History } from 'lucide-react'

/** Proceso que empezó en un año anterior y sigue abierto: "Seguimiento · 2024". */
export default function ChipSeguimiento({ fechaInicio }: { fechaInicio: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-[#f6ecdc] px-2.5 py-0.5 text-[11px] font-semibold text-[#8a5a14]">
      <History size={12} aria-hidden="true" />
      Seguimiento · {fechaInicio.slice(0, 4)}
    </span>
  )
}
