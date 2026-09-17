import { Link, useParams } from 'react-router-dom'
import ContenidoDetalleExpediente from './ContenidoDetalleExpediente'

interface DetalleExpedienteAreaProps {
  basePath: string
}

export default function DetalleExpedienteArea({ basePath }: DetalleExpedienteAreaProps) {
  const { id } = useParams<{ id: string }>()

  return (
    <div>
      <div className="mb-4">
        <Link to={basePath} className="text-sm font-medium text-brand-600 hover:underline">
          ← Volver al listado
        </Link>
      </div>

      {id && <ContenidoDetalleExpediente expedienteId={id} />}
    </div>
  )
}
