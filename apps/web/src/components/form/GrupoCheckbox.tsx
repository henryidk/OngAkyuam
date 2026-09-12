import type { UseFormRegisterReturn } from 'react-hook-form'

interface Opcion {
  value: string
  label: string
}

interface GrupoCheckboxProps {
  label: string
  registro: UseFormRegisterReturn
  opciones: readonly Opcion[]
  error?: string
  ayuda?: string
}

/** Checkboxes de selección múltiple — misma `registro` (mismo `name`) en cada input, RHF los colecta como array. */
export default function GrupoCheckbox({ label, registro, opciones, error, ayuda }: GrupoCheckboxProps) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-gray-800">{label}</legend>
      {ayuda && !error && <p className="mt-0.5 text-xs text-gray-500">{ayuda}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        {opciones.map((opcion) => (
          <label
            key={opcion.value}
            className="flex cursor-pointer items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm transition-colors has-checked:border-brand-500 has-checked:bg-brand-50"
          >
            <input type="checkbox" value={opcion.value} className="accent-brand-600" {...registro} />
            <span className="font-medium text-gray-800">{opcion.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </fieldset>
  )
}
