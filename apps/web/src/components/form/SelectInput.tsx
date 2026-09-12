import type { UseFormRegisterReturn } from 'react-hook-form'
import Campo from './Campo'

interface Opcion {
  value: string
  label: string
}

interface SelectInputProps {
  label: string
  registro: UseFormRegisterReturn
  opciones: readonly Opcion[]
  placeholder?: string
  error?: string
  ayuda?: string
  opcional?: boolean
}

export default function SelectInput({
  label,
  registro,
  opciones,
  placeholder,
  error,
  ayuda,
  opcional,
}: SelectInputProps) {
  return (
    <Campo label={label} htmlFor={registro.name} error={error} ayuda={ayuda} opcional={opcional}>
      <select
        id={registro.name}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        {...registro}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>
            {opcion.label}
          </option>
        ))}
      </select>
    </Campo>
  )
}
