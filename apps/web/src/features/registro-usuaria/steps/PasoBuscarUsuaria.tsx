import { UserPlus } from 'lucide-react'
import type { UsuariaResumenBusqueda } from '@akyuam/shared'
import BuscadorUsuaria from '../../trabajo-social/BuscadorUsuaria'

interface PasoBuscarUsuariaProps {
  onSeleccionar: (usuaria: UsuariaResumenBusqueda) => void
  onEsNueva: () => void
}

/**
 * Paso 0 del wizard: fuerza la búsqueda antes de capturar cualquier dato (principio del plan —
 * nunca se vuelve a pedir identidad si la usuaria ya existe).
 */
export default function PasoBuscarUsuaria({ onSeleccionar, onEsNueva }: PasoBuscarUsuariaProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Busca primero si la usuaria ya está registrada, por DPI o por nombre — evita crear un
        registro duplicado.
      </p>

      <BuscadorUsuaria
        onSeleccionar={onSeleccionar}
        accionesExtra={
          <button
            type="button"
            onClick={onEsNueva}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
          >
            <UserPlus className="h-4 w-4" />
            No la encontré, es una persona nueva
          </button>
        }
      />
    </div>
  )
}
