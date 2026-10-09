import type { ReactNode, Ref } from 'react'

type TonoCola = 'marca' | 'ambar' | 'neutro'

const CLASES_TONO: Record<TonoCola, { borde: string; titulo: string }> = {
  marca: { borde: 'border-brand-200', titulo: 'text-brand-700' },
  ambar: { borde: 'border-amber-200', titulo: 'text-amber-900' },
  neutro: { borde: 'border-gray-200', titulo: 'text-gray-900' },
}

interface TarjetaColaProps {
  titulo: string
  ayuda: string
  tono: TonoCola
  children: ReactNode
}

/** Marco común de las tres colas de la agenda: solo cambia el color del borde y del título. */
export default function TarjetaCola({ titulo, ayuda, tono, children }: TarjetaColaProps) {
  const clases = CLASES_TONO[tono]
  return (
    <section className={`rounded-lg border bg-white p-4 ${clases.borde}`}>
      <h2 className={`text-sm font-semibold ${clases.titulo}`}>{titulo}</h2>
      <p className="mt-0.5 text-[12.5px] text-gray-500">{ayuda}</p>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

interface FilaColaProps {
  nombre: string
  detalle: ReactNode
  /** El caso recién tomado: se tiñe para que no haya que buscarlo. */
  resaltada?: boolean
  ref?: Ref<HTMLDivElement>
  children: ReactNode
}

/** Un pendiente dentro de una cola: quién y qué a la izquierda, lo que toca hacer a la derecha. */
export function FilaCola({ nombre, detalle, resaltada = false, ref, children }: FilaColaProps) {
  return (
    <div
      ref={ref}
      className={`-mx-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-gray-100 px-2 py-2.5 ${
        resaltada ? 'rounded-md bg-brand-50' : ''
      }`}
    >
      <div className="min-w-0 flex-1 basis-36">
        <p className="truncate text-[13px] font-medium text-gray-900" title={nombre}>
          {nombre}
        </p>
        <div className="text-xs text-gray-500 tabular-nums">{detalle}</div>
      </div>
      <div className="flex flex-none items-center gap-1.5">{children}</div>
    </div>
  )
}
