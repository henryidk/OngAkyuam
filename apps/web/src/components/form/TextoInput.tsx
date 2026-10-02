import type { InputHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import Campo, { claseBordeCampo, idDescripcionCampo, type TonoAyuda } from './Campo'

interface TextoInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'id'> {
  label: string
  registro: UseFormRegisterReturn
  error?: string
  ayuda?: string
  tonoAyuda?: TonoAyuda
  opcional?: boolean
  modificado?: boolean
}

export default function TextoInput({
  label,
  registro,
  error,
  ayuda,
  tonoAyuda,
  opcional,
  modificado,
  className,
  ...resto
}: TextoInputProps) {
  return (
    <Campo
      label={label}
      htmlFor={registro.name}
      error={error}
      ayuda={ayuda}
      tonoAyuda={tonoAyuda}
      opcional={opcional}
      modificado={modificado}
    >
      <input
        id={registro.name}
        aria-invalid={error ? true : undefined}
        aria-describedby={idDescripcionCampo(registro.name, { error, ayuda })}
        className={`mt-1 w-full rounded border px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${claseBordeCampo({ error, modificado })} ${className ?? ''}`}
        {...registro}
        {...resto}
      />
    </Campo>
  )
}
