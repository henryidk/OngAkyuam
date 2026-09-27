import type { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

export type BotonVariante = 'primary' | 'secondary' | 'danger' | 'acento'
export type BotonTamano = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: BotonVariante
  tamano?: BotonTamano
  cargando?: boolean
}

const CLASES_VARIANTE: Record<BotonVariante, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary:
    'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  acento: 'border border-brand-300 bg-white text-brand-700 hover:bg-brand-50',
}

const CLASES_TAMANO: Record<BotonTamano, string> = {
  sm: 'rounded px-3 py-1.5 text-sm',
  md: 'rounded-md px-3.5 py-2 text-sm',
}

/** `acento` trae su propio tamaño compacto (plan de rediseño §12.1) y no participa de `tamano`. */
const CLASES_ACENTO_TAMANO = 'rounded-md px-2.5 py-1.5 text-xs'

export default function Button({
  variante = 'primary',
  tamano = 'sm',
  cargando = false,
  disabled,
  className,
  children,
  ...resto
}: ButtonProps) {
  const clasesTamano = variante === 'acento' ? CLASES_ACENTO_TAMANO : CLASES_TAMANO[tamano]
  return (
    <button
      className={`inline-flex items-center gap-1.5 font-medium transition-colors disabled:cursor-not-allowed ${clasesTamano} ${CLASES_VARIANTE[variante]} ${className ?? ''}`}
      disabled={disabled || cargando}
      {...resto}
    >
      {cargando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
}
