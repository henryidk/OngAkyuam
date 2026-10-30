import { History } from 'lucide-react'

/**
 * Proceso abierto de un expediente de un año anterior: "Seguimiento · 2014", el mismo año de su
 * carpeta en la lista. Gris pizarra, a propósito distinto del ámbar de las alertas: no es un
 * problema, es cartera heredada.
 */
export default function ChipSeguimiento({ anio }: { anio: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
      <History size={12} aria-hidden="true" />
      Seguimiento · {anio}
    </span>
  )
}
