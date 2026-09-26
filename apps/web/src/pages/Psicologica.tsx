import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExpedienteResumenArea } from '@akyuam/shared'
import PanelArea from '../features/area-atencion/PanelArea'
import DrawerDetalleExpediente from '../features/area-atencion/DrawerDetalleExpediente'
import Button from '../components/ui/Button'

export default function Psicologica() {
  const navigate = useNavigate()
  const [expedienteAbiertoId, setExpedienteAbiertoId] = useState<string | null>(null)

  return (
    <>
      <PanelArea
        basePath="/psicologia/pacientes"
        renderAcciones={(expediente: ExpedienteResumenArea) => (
          <div className="flex gap-2">
            <Button variante="secondary" onClick={() => setExpedienteAbiertoId(expediente.id)}>
              Ver datos de la usuaria
            </Button>
            <Button onClick={() => navigate(`/psicologia/pacientes/${expediente.id}`)}>Abrir expediente</Button>
          </div>
        )}
      />

      <DrawerDetalleExpediente expedienteId={expedienteAbiertoId} onCerrar={() => setExpedienteAbiertoId(null)} />
    </>
  )
}
