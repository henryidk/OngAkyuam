import { useState } from 'react'
import type { ConteoReporte } from '@akyuam/shared'
import { CLASE_TARJETA } from '../compartido/estilos'

/** Cuántos renglones se ven de entrada: los mayores. El resto (y los que están en cero) queda a un toque. */
const VISIBLES_DE_ENTRADA = 5

/**
 * Un desglose (edad, grupo étnico, tipología, municipio): barras horizontales de mayor a menor, con su
 * total y su porcentaje. El porcentaje es sobre la suma de la tarjeta.
 */
export default function TablaDesglose({ titulo, filas }: { titulo: string; filas: ConteoReporte[] }) {
  const [verTodo, setVerTodo] = useState(false)
  const conDatos = filas.filter((fila) => fila.total > 0).sort((a, b) => b.total - a.total)
  const suma = conDatos.reduce((acumulado, fila) => acumulado + fila.total, 0)
  const maximo = conDatos[0]?.total ?? 1
  const visibles = verTodo ? conDatos : conDatos.slice(0, VISIBLES_DE_ENTRADA)
  const ocultos = conDatos.length - visibles.length

  return (
    <section className={`${CLASE_TARJETA} flex flex-col gap-3 px-5 py-4`}>
      <h3 className="text-sm font-semibold text-texto">{titulo}</h3>
      {conDatos.length === 0 ? (
        <p className="text-[13px] text-texto-suave">Sin datos en este periodo.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibles.map((fila) => {
            const porcentaje = Math.round((fila.total / Math.max(suma, 1)) * 100)
            return (
              <li key={fila.clave} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 text-pretty text-texto">{fila.etiqueta}</span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-texto">{fila.total}</span>
                    <span className="ml-1.5 text-xs text-texto-suave">{porcentaje}%</span>
                  </span>
                </div>
                <div aria-hidden="true" className="h-2.5 overflow-hidden rounded bg-superficie-hundida">
                  <div className="h-full rounded bg-brand-500" style={{ width: `${Math.max(3, Math.round((fila.total / maximo) * 100))}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {(ocultos > 0 || verTodo) && conDatos.length > VISIBLES_DE_ENTRADA && (
        <button
          type="button"
          aria-expanded={verTodo}
          onClick={() => setVerTodo(!verTodo)}
          className="self-start text-xs font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          {verTodo ? 'Ver solo los 5 mayores' : `Ver ${ocultos} más`}
        </button>
      )}
    </section>
  )
}
