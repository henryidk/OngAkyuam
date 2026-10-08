import type { EstadoAtencionPsicologica } from '@akyuam/shared'
import { fechaDeInstante } from '../../../lib/formato'

interface BarraEtapaProps {
  etapa: EstadoAtencionPsicologica
  fechaInicio: string
  fechaCierre: string | null
  /** Un proceso puede cerrarse sin haber tenido ninguna sesión: entonces nunca pasó por Seguimiento. */
  huboSesiones: boolean
}

interface Paso {
  etiqueta: string
  detalle: string
  alcanzado: boolean
}

/** Las tres etapas del proceso, con la fecha de las que ya ocurrieron. */
export default function BarraEtapa({ etapa, fechaInicio, fechaCierre, huboSesiones }: BarraEtapaProps) {
  const cerrado = etapa === 'CIERRE'
  const pasos: Paso[] = [
    { etiqueta: 'Inicio', detalle: fechaDeInstante(fechaInicio), alcanzado: true },
    {
      etiqueta: 'Seguimiento',
      detalle: huboSesiones ? 'Desde la primera sesión' : cerrado ? 'Sin sesiones' : 'Al registrar la primera sesión',
      alcanzado: huboSesiones,
    },
    { etiqueta: 'Cierre', detalle: fechaCierre ? fechaDeInstante(fechaCierre) : 'Pendiente', alcanzado: cerrado },
  ]
  const claseActiva = cerrado ? 'border-green-700 bg-green-700 text-white' : 'border-brand-600 bg-brand-600 text-white'
  const claseLinea = cerrado ? 'bg-green-700' : 'bg-brand-600'

  return (
    <ol className="grid grid-cols-3 gap-2">
      {pasos.map((paso, indice) => {
        const siguiente = pasos[indice + 1]
        return (
          <li key={paso.etiqueta} className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border text-xs font-semibold ${
                  paso.alcanzado ? claseActiva : 'border-gray-300 bg-white text-gray-400'
                }`}
              >
                {indice + 1}
              </span>
              {siguiente && (
                <span className={`h-0.5 flex-1 rounded ${siguiente.alcanzado ? claseLinea : 'bg-gray-200'}`} />
              )}
            </div>
            <p className={`mt-1.5 text-sm font-medium ${paso.alcanzado ? 'text-gray-900' : 'text-gray-400'}`}>
              {paso.etiqueta}
              {!paso.alcanzado && <span className="sr-only"> (pendiente)</span>}
            </p>
            <p className="truncate text-xs text-gray-500">{paso.detalle}</p>
          </li>
        )
      })}
    </ol>
  )
}
