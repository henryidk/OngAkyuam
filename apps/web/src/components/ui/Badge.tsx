import type { ReactNode } from 'react'

export type BadgeTono = 'neutral' | 'success' | 'warning' | 'danger' | 'brand'

interface BadgeProps {
  tono?: BadgeTono
  children: ReactNode
}

/** Vocabulario de color restringido y consistente entre pantallas — nunca decorativo. */
const CLASES_TONO: Record<BadgeTono, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  brand: 'bg-brand-100 text-brand-700',
}

export default function Badge({ tono = 'neutral', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASES_TONO[tono]}`}
    >
      {children}
    </span>
  )
}
