import type { ReactNode } from 'react'

interface CampoProps {
  label: string
  htmlFor?: string
  error?: string
  ayuda?: string
  opcional?: boolean
  children: ReactNode
}

/** Envoltorio de label + input + texto de ayuda/error, consistente en todos los campos del formulario. */
export default function Campo({
  label,
  htmlFor,
  error,
  ayuda,
  opcional,
  children,
}: CampoProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-800" htmlFor={htmlFor}>
        {label}
        {opcional && <span className="ml-1 font-normal text-gray-400">(opcional)</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      ) : ayuda ? (
        <p className="mt-1 text-xs text-gray-500">{ayuda}</p>
      ) : null}
    </div>
  )
}
