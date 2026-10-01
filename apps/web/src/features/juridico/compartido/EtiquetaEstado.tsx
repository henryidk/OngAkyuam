import { ETIQUETAS_ESTADO_VISIBLE, type EstadoVisibleProceso } from '@akyuam/shared'
import { CLASES_ESTADO } from './colores'

export default function EtiquetaEstado({ estado }: { estado: EstadoVisibleProceso }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLASES_ESTADO[estado]}`}>
      {ETIQUETAS_ESTADO_VISIBLE[estado]}
    </span>
  )
}
