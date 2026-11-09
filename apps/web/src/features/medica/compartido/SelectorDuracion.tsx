import {
  DURACIONES_CITA_MEDICA_MIN,
  PERSONAS_SUGERIR_DURACION_MAYOR,
  type DuracionCitaMedica,
} from '@akyuam/shared'
import SelectorDuracionBase from '../../../components/agenda/SelectorDuracion'

interface SelectorDuracionProps {
  duracion: DuracionCitaMedica
  /** Cuántas personas se atienden: con varias se sugiere más tiempo (la médica decide). */
  personas: number
  onCambiar: (duracion: DuracionCitaMedica) => void
}

/**
 * Duración de la cita en Medicina (30 min, 1 h o 1 h 30): el selector compartido con Psicología
 * más la sugerencia de dar más tiempo cuando se atiende a varias personas en la misma cita.
 */
export default function SelectorDuracion({ duracion, personas, onCambiar }: SelectorDuracionProps) {
  const sugerirMas = personas >= PERSONAS_SUGERIR_DURACION_MAYOR && duracion === DURACIONES_CITA_MEDICA_MIN[0]
  return (
    <div>
      <SelectorDuracionBase opciones={DURACIONES_CITA_MEDICA_MIN} duracion={duracion} onCambiar={onCambiar} />
      {sugerirMas && (
        <p className="mt-1 text-right text-[12px] text-estado-pendiente">{personas} personas: considera 1 h o más.</p>
      )}
    </div>
  )
}
