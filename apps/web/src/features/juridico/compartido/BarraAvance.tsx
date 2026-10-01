import {
  ETIQUETAS_FASE,
  FASES_PROCESO_JURIDICO,
  type EstadoVisibleProceso,
  type FaseProcesoJuridico,
} from '@akyuam/shared'
import { CLASES_BARRA } from './colores'

interface BarraAvanceProps {
  fase: FaseProcesoJuridico
  estado: EstadoVisibleProceso
}

/** Versión compacta para listas: etiqueta de la fase y una barra de tres tramos. */
export function BarraAvanceCompacta({ fase, estado }: BarraAvanceProps) {
  const paso = FASES_PROCESO_JURIDICO.indexOf(fase) + 1
  return (
    <div>
      <p className="text-xs font-medium text-gray-700">{ETIQUETAS_FASE[fase]}</p>
      <div
        role="progressbar"
        aria-label="Avance del proceso"
        aria-valuemin={1}
        aria-valuemax={FASES_PROCESO_JURIDICO.length}
        aria-valuenow={paso}
        aria-valuetext={ETIQUETAS_FASE[fase]}
        className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className={`h-full rounded-full ${CLASES_BARRA[estado]}`}
          style={{ width: `${(paso / FASES_PROCESO_JURIDICO.length) * 100}%` }}
        />
      </div>
    </div>
  )
}

/** Los tres pasos del proceso, numerados, para el encabezado del detalle. */
export default function BarraAvance({ fase, estado }: BarraAvanceProps) {
  const actual = FASES_PROCESO_JURIDICO.indexOf(fase)
  return (
    <ol className="flex items-start rounded-xl border border-gray-200 bg-white px-5 py-4">
      {FASES_PROCESO_JURIDICO.map((paso, indice) => {
        const alcanzado = indice <= actual
        return (
          <li key={paso} className="flex flex-1 flex-col gap-1.5" aria-current={indice === actual ? 'step' : undefined}>
            <div className="flex items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  alcanzado ? `${CLASES_BARRA[estado]} text-white` : 'bg-gray-100 text-gray-500'
                }`}
              >
                {indice + 1}
              </span>
              {indice < FASES_PROCESO_JURIDICO.length - 1 && (
                <span className={`mx-2 h-0.5 flex-1 ${indice < actual ? CLASES_BARRA[estado] : 'bg-gray-200'}`} />
              )}
            </div>
            <span className={`text-xs ${alcanzado ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
              {ETIQUETAS_FASE[paso]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
