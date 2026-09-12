import type { UseFormRegisterReturn } from 'react-hook-form'

interface Opcion {
  value: string
  label: string
  descripcion?: string
}

interface GrupoRadioProps {
  label: string
  registro: UseFormRegisterReturn
  opciones: readonly Opcion[]
  error?: string
}

/** Radios como tarjetas seleccionables — misma `registro` (mismo `name`) en cada input, RHF colecta el valor marcado. */
export default function GrupoRadio({ label, registro, opciones, error }: GrupoRadioProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-800">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-3">
        {opciones.map((opcion) => (
          <label
            key={opcion.value}
            className="flex cursor-pointer items-start gap-2 rounded border border-gray-300 px-3 py-2 text-sm transition-colors has-checked:border-brand-500 has-checked:bg-brand-50"
          >
            <input type="radio" value={opcion.value} className="mt-0.5 accent-brand-600" {...registro} />
            <span>
              <span className="block font-medium text-gray-800">{opcion.label}</span>
              {opcion.descripcion && (
                <span className="block text-xs text-gray-500">{opcion.descripcion}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}
