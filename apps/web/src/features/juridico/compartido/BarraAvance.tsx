import {
  ETIQUETAS_FASE,
  FASES_PROCESO_JURIDICO,
  type EstadoVisibleProceso,
  type FaseProcesoJuridico,
} from '@akyuam/shared'
import { CLASES_BARRA, CLASES_BORDE_PASO } from './colores'

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

/** Los tres pasos del proceso en una línea (punto, tramo, punto) dentro de la cabecera del detalle. */
export default function BarraAvance({ fase, estado }: BarraAvanceProps) {
  const actual = FASES_PROCESO_JURIDICO.indexOf(fase)
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[13px]" aria-label="Avance del proceso">
      {FASES_PROCESO_JURIDICO.map((paso, indice) => {
        const alcanzado = indice <= actual
        return (
          <li key={paso} className="flex items-center gap-2" aria-current={indice === actual ? 'step' : undefined}>
            {indice > 0 && (
              <span aria-hidden="true" className={`h-0.5 w-6 sm:w-10 ${alcanzado ? CLASES_BARRA[estado] : 'bg-gray-200'}`} />
            )}
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                alcanzado ? `${CLASES_BARRA[estado]} ${CLASES_BORDE_PASO[estado]}` : 'border-gray-300 bg-white'
              }`}
            />
            <span className={`whitespace-nowrap ${alcanzado ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
              {ETIQUETAS_FASE[paso]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
