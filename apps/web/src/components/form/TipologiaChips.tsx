import { Check } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { ETIQUETAS_TIPOLOGIA_DELITO, TIPOLOGIAS_DELITO } from '@akyuam/shared'

interface TipologiaChipsProps {
  registro: UseFormRegisterReturn
  error?: string
}

/**
 * Tipología del delito como chips de selección múltiple. Cada chip es una casilla nativa (oculta
 * a la vista, no al teclado ni al lector de pantalla): RHF las colecta como arreglo.
 */
export default function TipologiaChips({ registro, error }: TipologiaChipsProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-800">Tipología del delito (Ley 22-2008)</legend>
      {!error && <p className="mt-0.5 text-xs text-gray-500">Selecciona todas las que apliquen.</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {TIPOLOGIAS_DELITO.map((tipologia) => (
          <label
            key={tipologia}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-700 has-focus-visible:ring-2 has-focus-visible:ring-brand-500"
          >
            <input type="checkbox" value={tipologia} className="peer sr-only" {...registro} />
            <span
              aria-hidden="true"
              className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border-[1.5px] border-gray-400 text-transparent peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white"
            >
              <Check size={10} strokeWidth={3.5} />
            </span>
            {ETIQUETAS_TIPOLOGIA_DELITO[tipologia]}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}
