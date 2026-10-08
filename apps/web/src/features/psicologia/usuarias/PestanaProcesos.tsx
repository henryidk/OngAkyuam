import { HeartHandshake } from 'lucide-react'
import EmptyState from '../../../components/ui/EmptyState'
import { useContextoFicha } from './contextoFicha'
import TarjetaProceso from './TarjetaProceso'

export default function PestanaProcesos() {
  const { ficha } = useContextoFicha()

  return (
    <section className="space-y-3">
      <p className="text-sm text-gray-500">
        Los procesos que llevas o llevaste con esta usuaria. Cada código se forma con el número del proceso y el
        expediente, por ejemplo <span className="font-mono text-gray-700">P1-{ficha.expediente.numero}</span>.
      </p>
      {ficha.procesos.length === 0 ? (
        <EmptyState
          Icono={HeartHandshake}
          titulo="Esta usuaria aún no tiene procesos psicológicos contigo"
          descripcion="Se abre al agendar la primera cita de la referencia."
        />
      ) : (
        ficha.procesos.map((proceso) => <TarjetaProceso key={proceso.id} proceso={proceso} />)
      )}
    </section>
  )
}
