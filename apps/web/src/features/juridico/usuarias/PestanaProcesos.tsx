import { Scale } from 'lucide-react'
import EmptyState from '../../../components/ui/EmptyState'
import { useContextoFicha } from './contextoFicha'
import TarjetaProceso from './TarjetaProceso'

export default function PestanaProcesos() {
  const { ficha } = useContextoFicha()

  return (
    <section className="space-y-3">
      <p className="text-sm text-gray-500">
        Todos los procesos que Jurídico lleva o llevó con esta usuaria. Cada proceso lleva el número del
        expediente; desde el segundo se le agrega su número, por ejemplo{' '}
        <span className="font-mono text-gray-700">{ficha.expediente.numero} · Proceso 2</span>.
      </p>
      {ficha.procesos.length === 0 ? (
        <EmptyState
          Icono={Scale}
          titulo="Esta usuaria aún no tiene procesos jurídicos"
          descripcion="Se abren al atender la referencia de Trabajo Social."
        />
      ) : (
        ficha.procesos.map((proceso) => <TarjetaProceso key={proceso.id} proceso={proceso} />)
      )}
    </section>
  )
}
