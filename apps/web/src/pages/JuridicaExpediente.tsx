import { useParams } from 'react-router-dom'
import EspacioTrabajoCaso from '../features/juridico/EspacioTrabajoCaso'

export default function JuridicaExpediente() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return <EspacioTrabajoCaso expedienteId={id} />
}
