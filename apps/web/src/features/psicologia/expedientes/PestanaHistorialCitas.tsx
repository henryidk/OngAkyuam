import { useParams } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import EmptyState from '../../../components/ui/EmptyState'
import Button from '../../../components/ui/Button'
import { useHistorialCitas } from '../hooks/useHistorialCitas'
import FilaCita from '../citas/FilaCita'

export default function PestanaHistorialCitas() {
  const { expedienteId } = useParams<{ expedienteId: string }>()
  const { citas, error, siguienteCursor, cargandoMas, cargarMas } = useHistorialCitas(expedienteId ?? '')

  if (error) {
    return <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  }

  if (citas === null) {
    return <p className="text-sm text-gray-500">Cargando historial…</p>
  }

  if (citas.length === 0) {
    return <EmptyState Icono={CalendarDays} titulo="Sin citas registradas" descripcion="Este expediente aún no tiene citas." />
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {citas.map((cita) => (
          <FilaCita key={cita.id} cita={cita} enlazarDetalleCita />
        ))}
      </div>
      {siguienteCursor && (
        <div className="text-center">
          <Button variante="secondary" cargando={cargandoMas} onClick={() => cargarMas()}>
            Cargar más
          </Button>
        </div>
      )}
    </div>
  )
}
