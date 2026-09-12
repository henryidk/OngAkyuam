import type { InputHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import Campo from './Campo'

interface TextoInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'id'> {
  label: string
  registro: UseFormRegisterReturn
  error?: string
  ayuda?: string
  opcional?: boolean
}

export default function TextoInput({
  label,
  registro,
  error,
  ayuda,
  opcional,
  className,
  ...resto
}: TextoInputProps) {
  return (
    <Campo label={label} htmlFor={registro.name} error={error} ayuda={ayuda} opcional={opcional}>
      <input
        id={registro.name}
        className={`mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${className ?? ''}`}
        {...registro}
        {...resto}
      />
    </Campo>
  )
}
