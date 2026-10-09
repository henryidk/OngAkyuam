import type { ConteoReporte } from '@akyuam/shared'
import { proporcion } from './calculos'

interface TablaDesgloseProps {
  titulo: string
  filas: ConteoReporte[]
  nota?: string
}

/** Un desglose de personas atendidas: cada renglón con su total y una barra proporcional al renglón más grande. */
export default function TablaDesglose({ titulo, filas, nota }: TablaDesgloseProps) {
  const maximo = Math.max(0, ...filas.map((fila) => fila.total))
  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-gray-200 bg-white px-[18px] py-4">
      <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="text-[13px] text-gray-500">Sin datos en este periodo.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filas.map((fila) => (
            <li key={fila.clave} className="flex flex-col gap-1">
              <div className="flex justify-between gap-3 text-[13px] text-gray-800">
                <span>{fila.etiqueta}</span>
                <span className="font-semibold">{fila.total}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-brand-500" style={{ width: `${proporcion(fila.total, maximo)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {nota && <p className="text-xs text-gray-500">{nota}</p>}
    </section>
  )
}
