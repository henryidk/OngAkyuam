import { nombreMesGT, type MesIndicadoresMedica } from '@akyuam/shared'
import { CLASE_TARJETA } from '../compartido/estilos'

interface BarrasPorMesProps {
  /** Cada mes del periodo, en orden: las mismas columnas que el Excel. */
  meses: MesIndicadoresMedica[]
  /** Posición del mes elegido en `meses`, o null para todo el periodo. */
  elegido: number | null
  onElegir: (indice: number | null) => void
}

function plural(cantidad: number, singular: string, pluralizado: string) {
  return `${cantidad} ${cantidad === 1 ? singular : pluralizado}`
}

/** Consultas por mes. Al tocar un mes, las cifras y desgloses de abajo pasan a ese mes; tocarlo otra vez lo quita. */
export default function BarrasPorMes({ meses, elegido, onElegir }: BarrasPorMesProps) {
  const maximo = Math.max(1, ...meses.map((mes) => mes.consultas))
  const variosAnios = meses.some((mes) => mes.anio !== meses[0]?.anio)
  // Columnas de ancho acotado: con pocos meses las barras no quedan perdidas en un lienzo enorme.
  const columnas = { gridTemplateColumns: `repeat(${meses.length}, minmax(36px, 76px))` }
  const mesElegido = elegido !== null ? meses[elegido] : null

  return (
    <section aria-labelledby="titulo-barras" className={`${CLASE_TARJETA} flex flex-col gap-3.5 px-5 py-[18px]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 id="titulo-barras" className="text-sm font-semibold text-[#1c2430]">
          Consultas por mes
        </h2>
        <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-3 text-[12.5px] text-[#5b6573]">
          {mesElegido ? (
            <>
              <span>
                {nombreMesGT(mesElegido.mes)} {mesElegido.anio}: {plural(mesElegido.consultas, 'consulta', 'consultas')} ·{' '}
                {plural(mesElegido.personasAtendidas, 'persona', 'personas')}
              </span>
              <button type="button" onClick={() => onElegir(null)} className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">
                Ver todo el periodo
              </button>
            </>
          ) : (
            'Toca un mes para ver su detalle'
          )}
        </p>
      </div>

      <div className="overflow-x-auto overflow-y-hidden">
        <div className="w-fit min-w-full">
          <div className="grid h-[160px] items-end justify-center gap-2 sm:gap-4" style={columnas}>
            {meses.map((mes, indice) => {
              const activo = elegido === indice
              const nombre = `${nombreMesGT(mes.mes)} ${mes.anio}`
              return (
                <button
                  key={`${mes.anio}-${mes.mes}`}
                  type="button"
                  aria-pressed={activo}
                  aria-label={`${nombre}: ${plural(mes.consultas, 'consulta', 'consultas')}, ${plural(mes.personasAtendidas, 'persona', 'personas')}`}
                  onClick={() => onElegir(activo ? null : indice)}
                  className="group flex h-full min-w-0 flex-col items-center justify-end gap-1 rounded-t"
                >
                  <span className="text-[11.5px] font-semibold tabular-nums text-[#1c2430]">{mes.consultas}</span>
                  <span
                    aria-hidden="true"
                    style={{ height: `${Math.round((mes.consultas / maximo) * 100)}%` }}
                    className={`w-full max-w-[38px] rounded-t transition-colors ${mes.consultas === 0 ? 'min-h-[2px]' : 'min-h-[6px]'} ${
                      activo ? 'bg-brand-950' : elegido !== null ? 'bg-brand-200 group-hover:bg-brand-400' : 'bg-brand-500 group-hover:bg-brand-600'
                    }`}
                  />
                </button>
              )
            })}
          </div>
          <div aria-hidden="true" className="grid justify-center gap-2 border-t border-[#e3e6ea] pt-1.5 sm:gap-4" style={columnas}>
            {meses.map((mes, indice) => (
              <span
                key={`${mes.anio}-${mes.mes}`}
                className={`text-center text-[11px] leading-tight sm:text-xs ${elegido === indice ? 'font-semibold text-[#1c2430]' : 'text-[#5b6573]'}`}
              >
                {nombreMesGT(mes.mes).slice(0, 3)}
                {variosAnios && <span className="block text-[10.5px]">{mes.anio}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
