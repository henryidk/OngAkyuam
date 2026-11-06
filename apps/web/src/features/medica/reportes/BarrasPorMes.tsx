import { nombreMesGT, type MesIndicadoresMedica } from '@akyuam/shared'
import { CLASE_TARJETA } from '../compartido/estilos'

interface BarrasPorMesProps {
  /** Cada mes del periodo, en orden: las mismas columnas que el Excel. */
  meses: MesIndicadoresMedica[]
  /** Posición del mes elegido en `meses`, o null para todo el periodo. */
  elegido: number | null
  onElegir: (indice: number | null) => void
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {texto}
    </span>
  )
}

/** Consultas y personas atendidas por mes. Al hacer clic en un mes, el detalle se filtra a ese mes. */
export default function BarrasPorMes({ meses, elegido, onElegir }: BarrasPorMesProps) {
  const maximo = Math.max(1, ...meses.map((periodo) => Math.max(periodo.consultas, periodo.personasAtendidas)))
  const alto = (valor: number) => `${Math.round((valor / maximo) * 100)}%`
  const variosAnios = meses.some((periodo) => periodo.anio !== meses[0]?.anio)
  const columnas = { gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }

  return (
    <section className={`${CLASE_TARJETA} flex flex-col gap-3.5 px-5 py-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#1c2430]">Por mes</h2>
        <div className="flex flex-wrap items-center gap-3.5 text-xs text-[#5b6573]">
          <Leyenda color="bg-[#7346a5]" texto="Consultas" />
          <Leyenda color="bg-[#cdb6ea]" texto="Personas atendidas" />
          {elegido !== null && (
            <button type="button" onClick={() => onElegir(null)} className="font-medium text-brand-700 hover:underline">
              Ver todo el periodo
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid h-[180px] items-end gap-1.5" style={columnas}>
            {meses.map((periodo, indice) => {
              const esElegido = elegido === indice
              const nombre = `${nombreMesGT(periodo.mes)} ${periodo.anio}`
              const resumen = `${nombre}: ${periodo.consultas} consultas, ${periodo.personasAtendidas} personas`
              return (
                <button
                  key={`${periodo.anio}-${periodo.mes}`}
                  type="button"
                  aria-pressed={esElegido}
                  aria-label={resumen}
                  title={resumen}
                  onClick={() => onElegir(esElegido ? null : indice)}
                  className={`flex h-full flex-col justify-end gap-1 rounded-md px-0.5 pt-1 ${
                    esElegido ? 'bg-[#f2ecfa]' : 'hover:bg-[#f8f9fa]'
                  } ${elegido !== null && !esElegido ? 'opacity-45' : ''}`}
                >
                  <span className="text-[11px] font-semibold tabular-nums text-[#374151]">{periodo.consultas}</span>
                  <span aria-hidden="true" className="flex h-[130px] items-end justify-center gap-0.5">
                    <span className="w-2/5 max-w-[14px] rounded-t-sm bg-[#7346a5]" style={{ height: alto(periodo.consultas) }} />
                    <span className="w-2/5 max-w-[14px] rounded-t-sm bg-[#cdb6ea]" style={{ height: alto(periodo.personasAtendidas) }} />
                  </span>
                </button>
              )
            })}
          </div>
          <div aria-hidden="true" className="mt-1 grid gap-1.5" style={columnas}>
            {meses.map((periodo, indice) => (
              <span
                key={`${periodo.anio}-${periodo.mes}`}
                className={`text-center text-[11.5px] leading-tight ${elegido === indice ? 'font-bold text-[#5b3985]' : 'font-medium text-[#5b6573]'}`}
              >
                {nombreMesGT(periodo.mes).slice(0, 3)}
                {variosAnios && <span className="block text-[10.5px]">{periodo.anio}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
