import { ETIQUETAS_FORMA_FINALIZACION, type FormaFinalizacionProceso } from '@akyuam/shared'
import { CLASES_FORMA } from './colores'

export default function EtiquetaForma({ forma }: { forma: FormaFinalizacionProceso }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASES_FORMA[forma]}`}>
      Por {ETIQUETAS_FORMA_FINALIZACION[forma]}
    </span>
  )
}
