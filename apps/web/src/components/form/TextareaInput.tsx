import type { TextareaHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import Campo from './Campo'

interface TextareaInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'id'> {
  label: string
  registro: UseFormRegisterReturn
  error?: string
  ayuda?: string
  opcional?: boolean
}

export default function TextareaInput({
  label,
  registro,
  error,
  ayuda,
  opcional,
  className,
  rows = 3,
  ...resto
}: TextareaInputProps) {
  return (
    <Campo label={label} htmlFor={registro.name} error={error} ayuda={ayuda} opcional={opcional}>
      <textarea
        id={registro.name}
        rows={rows}
        className={`mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${className ?? ''}`}
        {...registro}
        {...resto}
      />
    </Campo>
  )
}
