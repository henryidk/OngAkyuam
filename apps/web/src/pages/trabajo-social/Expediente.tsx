import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { UsuariaResumenBusqueda } from '@akyuam/shared'
import BuscadorUsuaria from '../../features/trabajo-social/BuscadorUsuaria'
import DetalleCasoTrabajoSocial from '../../features/trabajo-social/DetalleCasoTrabajoSocial'
import HubUsuaria from '../../features/trabajo-social/HubUsuaria'

type Vista =
  | { tipo: 'buscando' }
  | { tipo: 'hub'; usuariaId: string }
  | { tipo: 'caso'; usuariaId: string; expedienteId: string }

/** Estado de navegación para abrir directo una usuaria (o uno de sus casos) — p. ej. desde el wizard. */
interface EstadoNavegacionExpediente {
  usuariaId?: string
  expedienteId?: string
}

function vistaInicial(estado: EstadoNavegacionExpediente | null): Vista {
  if (!estado?.usuariaId) return { tipo: 'buscando' }
  if (estado.expedienteId) return { tipo: 'caso', usuariaId: estado.usuariaId, expedienteId: estado.expedienteId }
  return { tipo: 'hub', usuariaId: estado.usuariaId }
}

export default function Expediente() {
  const location = useLocation()
  const [vista, setVista] = useState<Vista>(() =>
    vistaInicial((location.state ?? null) as EstadoNavegacionExpediente | null),
  )

  if (vista.tipo === 'buscando') {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <header className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Expediente</h2>
            <p className="text-sm text-gray-500">
              Busca a una usuaria para ver su identidad y el historial completo de sus casos.
            </p>
          </header>
          <BuscadorUsuaria
            onSeleccionar={(usuaria: UsuariaResumenBusqueda) => setVista({ tipo: 'hub', usuariaId: usuaria.id })}
          />
        </div>
      </div>
    )
  }

  if (vista.tipo === 'hub') {
    return (
      <HubUsuaria
        usuariaId={vista.usuariaId}
        onVerCaso={(expedienteId) => setVista({ tipo: 'caso', usuariaId: vista.usuariaId, expedienteId })}
        onVolverABuscar={() => setVista({ tipo: 'buscando' })}
      />
    )
  }

  return (
    <DetalleCasoTrabajoSocial
      expedienteId={vista.expedienteId}
      onVolver={() => setVista({ tipo: 'hub', usuariaId: vista.usuariaId })}
    />
  )
}
