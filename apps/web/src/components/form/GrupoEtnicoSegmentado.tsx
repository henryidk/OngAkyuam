import type { UseFormRegisterReturn } from 'react-hook-form'
import { ETIQUETAS_GRUPO_ETNICO, GRUPOS_ETNICOS } from '@akyuam/shared'

interface GrupoEtnicoSegmentadoProps {
  registro: UseFormRegisterReturn
  error?: string
}

/**
 * Grupo étnico como botones segmentados: todas las opciones a la vista, sin abrir un desplegable.
 * Son radios nativos (ocultos a la vista, no al teclado ni al lector de pantalla), así que RHF los
 * registra igual que cualquier otro radio y las flechas cambian de opción.
 */
export default function GrupoEtnicoSegmentado({ registro, error }: GrupoEtnicoSegmentadoProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-800">Grupo étnico</legend>
      <div role="radiogroup" aria-label="Grupo étnico" className="mt-1 flex flex-wrap gap-2">
        {GRUPOS_ETNICOS.map((grupo) => (
          <label
            key={grupo}
            className="cursor-pointer rounded-md border border-gray-300 px-3.5 py-[7px] text-sm font-medium text-gray-700 transition-colors has-checked:border-brand-600 has-checked:bg-brand-50 has-checked:text-brand-700 has-focus-visible:ring-2 has-focus-visible:ring-brand-500"
          >
            <input type="radio" value={grupo} className="sr-only" {...registro} />
            {ETIQUETAS_GRUPO_ETNICO[grupo]}
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}
