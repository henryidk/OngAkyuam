import { useParams } from 'react-router-dom'
import EspacioTrabajoPsicologia from '../features/psicologia/EspacioTrabajoPsicologia'

export default function PsicologicaExpediente() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <EspacioTrabajoPsicologia expedienteId={id} />
}
