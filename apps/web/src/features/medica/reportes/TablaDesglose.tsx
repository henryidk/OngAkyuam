import type { ConteoReporte } from '@akyuam/shared'
import { CLASE_TARJETA } from '../compartido/estilos'

/** Un desglose (edad, grupo étnico, tipología, municipio) con barra proporcional al mayor. */
export default function TablaDesglose({ titulo, nota, filas }: { titulo: string; nota: string; filas: ConteoReporte[] }) {
  const maximo = Math.max(1, ...filas.map((fila) => fila.total))
  return (
    <section className={`${CLASE_TARJETA} flex flex-col gap-2.5 px-5 pb-4 pt-3.5`}>
      <div className="flex flex-col gap-px">
        <h2 className="text-sm font-semibold text-[#1c2430]">{titulo}</h2>
        <p className="text-xs text-[#5b6573]">{nota}</p>
      </div>
      {filas.length === 0 ? (
        <p className="text-[13px] text-[#9aa4b0]">Sin datos en este periodo.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filas.map((fila) => (
            <li key={fila.clave} className="grid grid-cols-[minmax(120px,1.2fr)_minmax(0,2fr)_36px] items-center gap-2.5 text-[13px]">
              <span className="text-pretty text-[#1c2430]">{fila.etiqueta}</span>
              <span aria-hidden="true" className="h-2 overflow-hidden rounded bg-[#f2ecfa]">
                <span className="block h-full rounded bg-[#8c58ac]" style={{ width: `${Math.round((fila.total / maximo) * 100)}%` }} />
              </span>
              <span className="text-right font-semibold tabular-nums text-[#1c2430]">{fila.total}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
