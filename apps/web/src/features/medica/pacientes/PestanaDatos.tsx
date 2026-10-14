import ContenidoDetalleExpediente from '../../area-atencion/ContenidoDetalleExpediente'
import { fechaDeInstante } from '../compartido/fechas'
import { useContextoFicha } from './contextoFicha'

/**
 * Datos y caso: lo que registró Trabajo Social, de solo lectura. Reutiliza la vista común de las
 * áreas, que pide el expediente al servidor y solo muestra lo que Trabajo Social compartió.
 */
export default function PestanaDatos() {
  const { ficha } = useContextoFicha()
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[#5b6573] tabular-nums">
        Datos de Trabajo Social, de solo lectura · actualizados el {fechaDeInstante(ficha.actualizadoPorTsEn)}. Si algo está mal, se corrige en Trabajo Social.
      </p>
      <ContenidoDetalleExpediente expedienteId={ficha.expedienteId} />
    </div>
  )
}
