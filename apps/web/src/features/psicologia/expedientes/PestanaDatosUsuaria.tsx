import { useParams } from 'react-router-dom'
import ContenidoDetalleExpediente from '../../area-atencion/ContenidoDetalleExpediente'

export default function PestanaDatosUsuaria() {
  const { expedienteId } = useParams<{ expedienteId: string }>()

  if (!expedienteId) return null

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Datos registrados por Trabajo Social.</p>
      <ContenidoDetalleExpediente expedienteId={expedienteId} />
    </div>
  )
}
