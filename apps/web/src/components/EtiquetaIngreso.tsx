import { ETIQUETAS_INGRESO_AREA, type TipoIngresoArea } from '@akyuam/shared'
import Badge from './ui/Badge'

/**
 * "Primer ingreso" / "Seguimiento" de una referencia: si es la primera vez en su vida que la
 * usuaria llega al área. El primer ingreso se destaca; el seguimiento va en gris.
 */
export default function EtiquetaIngreso({ ingreso }: { ingreso: TipoIngresoArea }) {
  return (
    <Badge tono={ingreso === 'PRIMER_INGRESO' ? 'brand' : 'neutral'}>{ETIQUETAS_INGRESO_AREA[ingreso]}</Badge>
  )
}
