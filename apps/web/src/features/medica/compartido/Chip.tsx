import type { ReactNode } from 'react'
import { CLASES_TONO, type TonoMedica } from './estilos'

/** Píldora de estado (cita, situación, espera). El texto siempre acompaña al color. */
export default function Chip({ tono, children }: { tono: TonoMedica; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ${CLASES_TONO[tono]}`}
    >
      {children}
    </span>
  )
}
