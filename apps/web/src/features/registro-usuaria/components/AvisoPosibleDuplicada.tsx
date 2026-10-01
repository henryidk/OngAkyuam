import { Link } from 'react-router-dom'
import type { UsuariaResumenBusqueda } from '@akyuam/shared'
import Button from '../../../components/ui/Button'

interface AvisoPosibleDuplicadaProps {
  coincidencias: UsuariaResumenBusqueda[]
  onRegistrarCasoPara: (usuariaId: string) => void
}

/** Avisa, sin bloquear: sin DPI no hay forma segura de saber si es la misma persona — lo decide quien registra. */
export default function AvisoPosibleDuplicada({ coincidencias, onRegistrarCasoPara }: AvisoPosibleDuplicadaProps) {
  return (
    <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-700">Posible registro duplicado</p>
      <p className="mt-0.5 text-xs text-amber-700">
        Ya hay {coincidencias.length === 1 ? 'una usuaria registrada' : 'usuarias registradas'} con un nombre parecido y
        la misma fecha de nacimiento.
      </p>
      <ul className="mt-2 space-y-2">
        {coincidencias.map((usuaria) => (
          <li key={usuaria.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-sm text-gray-800">
              {usuaria.nombres} {usuaria.apellidos}
              {usuaria.numeroExpediente && (
                <span className="tabular-nums text-gray-500"> · Expediente {usuaria.numeroExpediente}</span>
              )}
            </span>
            <Button type="button" variante="secondary" onClick={() => onRegistrarCasoPara(usuaria.id)}>
              Registrar un nuevo caso para ella
            </Button>
            <Link
              to={`/trabajo-social/usuarias/${usuaria.id}`}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Ir a su ficha
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-600">Si es otra persona, pulsa «Siguiente» de nuevo para continuar.</p>
    </div>
  )
}
