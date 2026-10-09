import type { ReferenciaPendientePsicologia } from '@akyuam/shared'

const ETIQUETAS: Record<ReferenciaPendientePsicologia, string> = {
  SIN_TOMAR: 'Referencia nueva',
  POR_AGENDAR: 'Por agendar',
}

/** La misma insignia en la lista de Usuarias y en la ficha: "nueva" solo si nadie tomó el caso. */
export default function InsigniaReferencia({ estado }: { estado: ReferenciaPendientePsicologia }) {
  return (
    <span className="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-medium text-[#b45309]">
      {ETIQUETAS[estado]}
    </span>
  )
}
