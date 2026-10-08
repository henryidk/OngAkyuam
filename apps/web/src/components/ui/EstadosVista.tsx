import { AlertCircle, Lock } from 'lucide-react'
import Button from './Button'
import EmptyState from './EmptyState'

/** Bloques grises mientras llega el dato: la pantalla no salta al aparecer el contenido. */
export function Esqueleto({ filas = 3 }: { filas?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="space-y-3">
      {Array.from({ length: filas }, (_, indice) => (
        <div key={indice} className="h-20 animate-pulse rounded-xl bg-gray-200/70" />
      ))}
    </div>
  )
}

interface ErrorVistaProps {
  mensaje: string
  sinPermiso?: boolean
  /** Qué es lo que no se puede ver, p. ej. "este proceso". No revela si existe o no. */
  recurso?: string
  onReintentar: () => void
}

export function ErrorVista({ mensaje, sinPermiso = false, recurso = 'esta información', onReintentar }: ErrorVistaProps) {
  if (sinPermiso) {
    return <EmptyState Icono={Lock} titulo={`No tiene acceso a ${recurso}`} />
  }
  return (
    <EmptyState
      Icono={AlertCircle}
      titulo="No se pudo cargar"
      descripcion={mensaje}
      accion={
        <Button variante="secondary" onClick={onReintentar}>
          Reintentar
        </Button>
      }
    />
  )
}
