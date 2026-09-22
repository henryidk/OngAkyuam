import { useState } from 'react'
import type { UsuariaResumenBusqueda } from '@akyuam/shared'
import BuscadorUsuaria from '../../features/trabajo-social/BuscadorUsuaria'
import DetalleCasoTrabajoSocial from '../../features/trabajo-social/DetalleCasoTrabajoSocial'
import HubUsuaria from '../../features/trabajo-social/HubUsuaria'

type Vista =
  | { tipo: 'buscando' }
  | { tipo: 'hub'; usuariaId: string }
  | { tipo: 'caso'; usuariaId: string; expedienteId: string }

export default function Expediente() {
  const [vista, setVista] = useState<Vista>({ tipo: 'buscando' })

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
