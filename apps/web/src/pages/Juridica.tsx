import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExpedienteResumenArea } from '@akyuam/shared'
import PanelArea from '../features/area-atencion/PanelArea'
import Button from '../components/ui/Button'
import DrawerDetalleExpediente from '../features/juridico/DrawerDetalleExpediente'

export default function Juridica() {
  const navigate = useNavigate()
  const [expedienteAbiertoId, setExpedienteAbiertoId] = useState<string | null>(null)

  return (
    <>
      <PanelArea
        basePath="/juridico"
        renderAcciones={(expediente: ExpedienteResumenArea) => (
          <div className="flex gap-2">
            <Button variante="secondary" onClick={() => setExpedienteAbiertoId(expediente.id)}>
              Ver datos de la usuaria
            </Button>
            <Button onClick={() => navigate(`/juridico/${expediente.id}/casos`)}>Registrar proceso</Button>
          </div>
        )}
      />

      <DrawerDetalleExpediente expedienteId={expedienteAbiertoId} onCerrar={() => setExpedienteAbiertoId(null)} />
    </>
  )
}
