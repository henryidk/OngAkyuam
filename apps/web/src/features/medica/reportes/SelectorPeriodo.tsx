import { sumarDiasGT, sumarMesesGT } from '@akyuam/shared'
import { CLASE_CAMPO } from '../compartido/estilos'

export interface Periodo {
  desde: string
  hasta: string
}

interface Atajo {
  etiqueta: string
  periodo: (hoy: string) => Periodo
}

/** Fechas de calendario como strings "YYYY-MM-DD": nunca pasan por `Date`. */
const ATAJOS: Atajo[] = [
  { etiqueta: 'Este mes', periodo: (hoy) => ({ desde: `${hoy.slice(0, 8)}01`, hasta: hoy }) },
  {
    etiqueta: 'Mes anterior',
    periodo: (hoy) => {
      const primeroDeEste = `${hoy.slice(0, 8)}01`
      return { desde: sumarMesesGT(primeroDeEste, -1), hasta: sumarDiasGT(primeroDeEste, -1) }
    },
  },
  { etiqueta: 'Este año', periodo: (hoy) => ({ desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy }) },
]

export function periodoDelMes(hoy: string): Periodo {
  return ATAJOS[0].periodo(hoy)
}

interface SelectorPeriodoProps {
  hoy: string
  campos: Periodo
  onCambiar: (periodo: Periodo) => void
  /** Mensaje si el periodo escrito no sirve; se anuncia sin interrumpir mientras se teclea. */
  error: string | null
}

const CLASE_ETIQUETA = 'flex flex-col gap-1 text-xs font-medium text-[#5b6573]'

/** El único periodo de la pantalla: lo usan el informe y los indicadores, en pantalla y en Excel. */
export default function SelectorPeriodo({ hoy, campos, onCambiar, error }: SelectorPeriodoProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div role="group" aria-label="Atajos de periodo" className="flex rounded-md border border-[#d5dadf] bg-white p-0.5">
          {ATAJOS.map((atajo) => {
            const periodo = atajo.periodo(hoy)
            const activo = periodo.desde === campos.desde && periodo.hasta === campos.hasta
            return (
              <button
                key={atajo.etiqueta}
                type="button"
                aria-pressed={activo}
                onClick={() => onCambiar(periodo)}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  activo ? 'bg-brand-600 text-white' : 'text-[#374151] hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {atajo.etiqueta}
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className={CLASE_ETIQUETA}>
            Desde
            <input
              type="date"
              value={campos.desde}
              max={campos.hasta || hoy}
              onChange={(evento) => onCambiar({ ...campos, desde: evento.target.value })}
              aria-invalid={error !== null}
              className={`${CLASE_CAMPO} w-[150px] py-1.5 tabular-nums`}
            />
          </label>
          <span aria-hidden="true" className="pb-2 text-[#9aa4b0]">
            –
          </span>
          <label className={CLASE_ETIQUETA}>
            Hasta
            <input
              type="date"
              value={campos.hasta}
              min={campos.desde || undefined}
              max={hoy}
              onChange={(evento) => onCambiar({ ...campos, hasta: evento.target.value })}
              aria-invalid={error !== null}
              className={`${CLASE_CAMPO} w-[150px] py-1.5 tabular-nums`}
            />
          </label>
        </div>
      </div>
      <p aria-live="polite" className={error ? 'text-[13px] text-[#9b2c20]' : 'sr-only'}>
        {error && `${error}. Se siguen mostrando las cifras del último periodo válido.`}
      </p>
    </div>
  )
}
