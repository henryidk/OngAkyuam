import { nombreMesGT, type PeriodoMedica } from '@akyuam/shared'
import { CLASE_TARJETA } from '../compartido/estilos'

interface BarrasPorMesProps {
  meses: PeriodoMedica[]
  /** Mes elegido (1-12) o null para el año completo. */
  mes: number | null
  /** Último mes con datos (1-12): los posteriores aún no ocurren y no se pueden elegir. */
  ultimoMes: number
  onElegir: (mes: number | null) => void
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {texto}
    </span>
  )
}

/** Consultas y personas atendidas por mes. Al hacer clic en un mes, el reporte se filtra a ese mes. */
export default function BarrasPorMes({ meses, mes, ultimoMes, onElegir }: BarrasPorMesProps) {
  const maximo = Math.max(1, ...meses.map((periodo) => Math.max(periodo.consultas, periodo.personasAtendidas)))
  const alto = (valor: number) => `${Math.round((valor / maximo) * 100)}%`

  return (
    <section className={`${CLASE_TARJETA} flex flex-col gap-3.5 px-5 py-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#1c2430]">Por mes</h2>
        <div className="flex flex-wrap items-center gap-3.5 text-xs text-[#5b6573]">
          <Leyenda color="bg-[#7346a5]" texto="Consultas" />
          <Leyenda color="bg-[#cdb6ea]" texto="Personas atendidas" />
          {mes !== null && (
            <button type="button" onClick={() => onElegir(null)} className="font-medium text-brand-700 hover:underline">
              Ver todo el año
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid h-[180px] grid-cols-12 items-end gap-1.5">
            {meses.map((periodo, indice) => {
              const numero = indice + 1
              const futuro = numero > ultimoMes
              const elegido = mes === numero
              const nombre = nombreMesGT(numero)
              return (
                <button
                  key={numero}
                  type="button"
                  disabled={futuro}
                  aria-pressed={elegido}
                  aria-label={`${nombre}: ${periodo.consultas} consultas, ${periodo.personasAtendidas} personas`}
                  title={futuro ? undefined : `${nombre}: ${periodo.consultas} consultas, ${periodo.personasAtendidas} personas`}
                  onClick={() => onElegir(elegido ? null : numero)}
                  className={`flex h-full flex-col justify-end gap-1 rounded-md px-0.5 pt-1 disabled:cursor-default ${
                    elegido ? 'bg-[#f2ecfa]' : 'hover:bg-[#f8f9fa] disabled:hover:bg-transparent'
                  } ${mes !== null && !elegido ? 'opacity-45' : ''}`}
                >
                  <span className="text-[11px] font-semibold tabular-nums text-[#374151]">{futuro ? '' : periodo.consultas}</span>
                  <span aria-hidden="true" className="flex h-[130px] items-end justify-center gap-0.5">
                    <span className="w-2/5 max-w-[14px] rounded-t-sm bg-[#7346a5]" style={{ height: alto(periodo.consultas) }} />
                    <span className="w-2/5 max-w-[14px] rounded-t-sm bg-[#cdb6ea]" style={{ height: alto(periodo.personasAtendidas) }} />
                  </span>
                </button>
              )
            })}
          </div>
          <div aria-hidden="true" className="mt-1 grid grid-cols-12 gap-1.5">
            {meses.map((_, indice) => (
              <span
                key={indice}
                className={`text-center text-[11.5px] ${mes === indice + 1 ? 'font-bold text-[#5b3985]' : 'font-medium text-[#5b6573]'}`}
              >
                {nombreMesGT(indice + 1).slice(0, 3)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
