import { useId } from 'react'
import { ALCANCES_PSICOLOGIA, type AlcancePsicologia } from '@akyuam/shared'

interface SelectorAlcanceProps {
  /** Lo que se elige, para el lector de pantalla y como rótulo visible ("Procesos", "Atendidas por"). */
  etiqueta: string
  valor: AlcancePsicologia
  /** "Mías" en vez de "Míos" cuando se habla de sesiones. */
  femenino?: boolean
  onCambio: (alcance: AlcancePsicologia) => void
}

/**
 * Segmentado Míos · Del equipo. Leer lo del equipo está permitido a toda el área; el servidor
 * deja constancia de cada consulta "Del equipo".
 */
export default function SelectorAlcance({ etiqueta, valor, femenino = false, onCambio }: SelectorAlcanceProps) {
  const idEtiqueta = useId()
  const textos: Record<AlcancePsicologia, string> = { MIOS: femenino ? 'Mías' : 'Míos', EQUIPO: 'Del equipo' }
  return (
    <div className="flex flex-col gap-1">
      <span id={idEtiqueta} className="text-xs font-medium text-gray-600">
        {etiqueta}
      </span>
      <div role="radiogroup" aria-labelledby={idEtiqueta} className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
        {ALCANCES_PSICOLOGIA.map((alcance) => {
          const elegido = alcance === valor
          return (
            <button
              key={alcance}
              type="button"
              role="radio"
              aria-checked={elegido}
              onClick={() => onCambio(alcance)}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium ${
                elegido ? 'bg-brand-600 text-white' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {textos[alcance]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
