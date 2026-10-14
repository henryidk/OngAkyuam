import { ETIQUETAS_ESTADO_CITA_MEDICA, type EstadoCitaMedicaDerivado } from '@akyuam/shared'
import Chip from './Chip'
import { TONO_ESTADO_CITA } from './estilos'

export default function EstadoCita({ estado }: { estado: EstadoCitaMedicaDerivado }) {
  return <Chip tono={TONO_ESTADO_CITA[estado]}>{ETIQUETAS_ESTADO_CITA_MEDICA[estado]}</Chip>
}
