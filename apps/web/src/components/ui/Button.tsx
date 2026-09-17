import type { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

export type BotonVariante = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: BotonVariante
  cargando?: boolean
}

const CLASES_VARIANTE: Record<BotonVariante, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary:
    'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
}

export default function Button({
  variante = 'primary',
  cargando = false,
  disabled,
  className,
  children,
  ...resto
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${CLASES_VARIANTE[variante]} ${className ?? ''}`}
      disabled={disabled || cargando}
      {...resto}
    >
      {cargando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
}
