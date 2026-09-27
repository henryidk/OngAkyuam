import { FileText } from 'lucide-react'
import EmptyState from '../../../components/ui/EmptyState'

export default function PestanaDocumentos() {
  return (
    <EmptyState
      Icono={FileText}
      titulo="Documentos"
      descripcion="Los formatos generales y documentos habilitados por Trabajo Social se habilitan en una fase posterior."
    />
  )
}
