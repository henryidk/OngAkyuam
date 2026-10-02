import type { ReactNode } from 'react'

export type TonoAyuda = 'neutral' | 'aviso'

interface CampoProps {
  label: string
  htmlFor?: string
  error?: string
  ayuda?: string
  tonoAyuda?: TonoAyuda
  opcional?: boolean
  /** Muestra "Modificado" junto a la etiqueta (edición en línea). */
  modificado?: boolean
  children: ReactNode
}

const CLASES_TONO_AYUDA: Record<TonoAyuda, string> = {
  neutral: 'text-gray-500',
  aviso: 'text-amber-700',
}

/** Id del texto de ayuda/error de un campo, para el `aria-describedby` de su input. */
export function idDescripcionCampo(idCampo: string, descripcion: { error?: string; ayuda?: string }) {
  return descripcion.error || descripcion.ayuda ? `${idCampo}-descripcion` : undefined
}

/** Borde del input según su estado: el error manda sobre "modificado". */
export function claseBordeCampo(estado: { error?: string; modificado?: boolean }) {
  if (estado.error) return 'border-red-600'
  return estado.modificado ? 'border-brand-400' : 'border-gray-300'
}

/** Envoltorio de label + input + texto de ayuda/error, consistente en todos los campos del formulario. */
export default function Campo({
  label,
  htmlFor,
  error,
  ayuda,
  tonoAyuda = 'neutral',
  opcional,
  modificado,
  children,
}: CampoProps) {
  const idDescripcion = htmlFor ? idDescripcionCampo(htmlFor, { error, ayuda }) : undefined
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label className="block text-sm font-medium text-gray-800" htmlFor={htmlFor}>
          {label}
          {opcional && <span className="ml-1 font-normal text-gray-500">(opcional)</span>}
        </label>
        {modificado && <span className="text-xs text-brand-600">Modificado</span>}
      </div>
      {children}
      {error ? (
        <p id={idDescripcion} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : ayuda ? (
        <p id={idDescripcion} className={`mt-1 text-xs ${CLASES_TONO_AYUDA[tonoAyuda]}`}>
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}
