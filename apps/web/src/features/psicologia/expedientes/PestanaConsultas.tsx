import { ClipboardList } from 'lucide-react'
import EmptyState from '../../../components/ui/EmptyState'

export default function PestanaConsultas() {
  return (
    <EmptyState
      Icono={ClipboardList}
      titulo="Consultas registradas"
      descripcion="El detalle de cada consulta (temas, intervención, recomendaciones) se habilita en una fase posterior."
    />
  )
}
