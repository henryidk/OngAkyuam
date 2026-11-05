import { Check } from 'lucide-react'
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

interface PasosProcesoProps extends BarraAvanceProps {
  /** Una línea de contexto bajo cada fase (fecha de inicio, último avance, cierre). */
  detalles: Record<FaseProcesoJuridico, string>
}

/**
 * Los tres pasos del proceso repartidos a lo ancho de la cabecera: hecho (con check), actual (anillo
 * con punto) y pendiente (círculo vacío). El color sigue al estado: morado en trámite, gris en
 * pausa, ámbar si se abandonó, verde al finalizar.
 */
export default function BarraAvance({ fase, estado, detalles }: PasosProcesoProps) {
  const actual = FASES_PROCESO_JURIDICO.indexOf(fase)
  const terminado = fase === 'FINALIZADO'
  const ultimo = FASES_PROCESO_JURIDICO.length - 1
  return (
    <ol className="grid grid-cols-[1fr_1fr_auto]" aria-label="Avance del proceso">
      {FASES_PROCESO_JURIDICO.map((paso, indice) => {
        const hecho = indice < actual || (terminado && indice === actual)
        const enCurso = indice === actual && !terminado
        const alcanzado = hecho || enCurso
        return (
          <li key={paso} className="min-w-0" aria-current={indice === actual ? 'step' : undefined}>
            <div className="flex items-center">
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  hecho
                    ? `${CLASES_BARRA[estado]} ${CLASES_BORDE_PASO[estado]} text-white`
                    : enCurso
                      ? `bg-white ${CLASES_BORDE_PASO[estado]}`
                      : 'border-gray-300 bg-white'
                }`}
              >
                {hecho && <Check size={12} strokeWidth={3} />}
                {enCurso && <span className={`h-2 w-2 rounded-full ${CLASES_BARRA[estado]}`} />}
              </span>
              {indice < ultimo && (
                <span
                  aria-hidden="true"
                  className={`mx-2 h-0.5 flex-1 rounded-full ${indice < actual ? CLASES_BARRA[estado] : 'bg-gray-200'}`}
                />
              )}
            </div>
            <p className={`mt-2 pr-3 text-[13px] ${alcanzado ? 'font-semibold text-gray-900' : 'font-medium text-gray-500'}`}>
              {ETIQUETAS_FASE[paso]}
            </p>
            <p className="mt-0.5 pr-3 text-xs text-gray-500 tabular-nums">{detalles[paso]}</p>
          </li>
        )
      })}
    </ol>
  )
}
