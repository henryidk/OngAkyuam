import {
  DURACIONES_CITA_MEDICA_MIN,
  ETIQUETAS_DURACION_CITA_MEDICA,
  PERSONAS_SUGERIR_DURACION_MAYOR,
  type DuracionCitaMedica,
} from '@akyuam/shared'

interface SelectorDuracionProps {
  duracion: DuracionCitaMedica
  /** Cuántas personas se atienden: con varias se sugiere más tiempo (la médica decide). */
  personas: number
  onCambiar: (duracion: DuracionCitaMedica) => void
}

/** Duración de la cita: 30 min, 1 h o 1 h 30. Solo se ofrecen horas donde cabe completa. */
export default function SelectorDuracion({ duracion, personas, onCambiar }: SelectorDuracionProps) {
  const sugerirMas = personas >= PERSONAS_SUGERIR_DURACION_MAYOR && duracion === DURACIONES_CITA_MEDICA_MIN[0]
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id="etiqueta-duracion" className="text-[13px] font-medium text-[#1c2430]">
          Duración
        </span>
        <div role="radiogroup" aria-labelledby="etiqueta-duracion" className="grid grid-cols-3 gap-1 rounded-lg bg-[#f0f2f4] p-1">
          {DURACIONES_CITA_MEDICA_MIN.map((opcion) => (
            <button
              key={opcion}
              type="button"
              role="radio"
              aria-checked={duracion === opcion}
              onClick={() => onCambiar(opcion)}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium ${
                duracion === opcion ? 'bg-white text-[#5b3985] shadow-sm' : 'text-[#5b6573] hover:text-[#1c2430]'
              }`}
            >
              {ETIQUETAS_DURACION_CITA_MEDICA[opcion]}
            </button>
          ))}
        </div>
      </div>
      {sugerirMas && (
        <p className="mt-1 text-right text-[12px] text-[#8a5a14]">{personas} personas: considera 1 h o más.</p>
      )}
    </div>
  )
}
