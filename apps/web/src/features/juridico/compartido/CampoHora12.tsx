import { useId, useState } from 'react'
import { CLASE_CAMPO } from './campos'
import { ETIQUETAS_PERIODO, aHora12, aHora24, type Periodo } from './hora12'

const HORAS = Array.from({ length: 12 }, (_, indice) => String(indice + 1))
const PERIODOS: Periodo[] = ['AM', 'PM']

interface CampoHora12Props {
  etiqueta: string
  /** "HH:mm" de 24 horas, o "" mientras falte algo por elegir. */
  valor: string
  onCambiar: (hhmm: string) => void
  /** Cada cuántos minutos se ofrecen (5 → 00, 05, 10…). */
  pasoMinutos: number
}

/**
 * Hora en 12 horas: hora, minutos y a. m./p. m. El `<input type="time">` sigue el idioma del
 * equipo y en muchos sale en 24 horas. Sin a. m./p. m. elegido no hay hora: adivinarlo pondría
 * una audiencia de las 2 de la tarde a las 2 de la madrugada.
 */
export default function CampoHora12({ etiqueta, valor, onCambiar, pasoMinutos }: CampoHora12Props) {
  const inicial = aHora12(valor)
  const [hora, setHora] = useState(inicial ? String(inicial.hora) : '')
  const [minutos, setMinutos] = useState(inicial?.minutos ?? '00')
  const [periodo, setPeriodo] = useState<Periodo | ''>(inicial?.periodo ?? '')
  const id = useId()
  const opcionesMinutos = Array.from({ length: Math.ceil(60 / pasoMinutos) }, (_, indice) =>
    String(indice * pasoMinutos).padStart(2, '0'),
  )

  function cambiar(cambios: { hora?: string; minutos?: string; periodo?: Periodo }) {
    const siguiente = { hora, minutos, periodo, ...cambios }
    setHora(siguiente.hora)
    setMinutos(siguiente.minutos)
    setPeriodo(siguiente.periodo)
    onCambiar(
      siguiente.hora && siguiente.periodo
        ? aHora24({ hora: Number(siguiente.hora), minutos: siguiente.minutos, periodo: siguiente.periodo })
        : '',
    )
  }

  return (
    <fieldset className="text-xs font-medium text-gray-600">
      <legend id={id}>
        {etiqueta}
      </legend>
      <div className="flex items-stretch gap-1.5">
        <select
          aria-label="Hora"
          value={hora}
          onChange={(evento) => cambiar({ hora: evento.target.value })}
          className={`${CLASE_CAMPO} min-w-0 flex-1 tabular-nums`}
        >
          <option value="">--</option>
          {HORAS.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="self-center text-sm text-gray-500">
          :
        </span>
        <select
          aria-label="Minutos"
          value={minutos}
          onChange={(evento) => cambiar({ minutos: evento.target.value })}
          className={`${CLASE_CAMPO} min-w-0 flex-1 tabular-nums`}
        >
          {opcionesMinutos.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
        <div role="group" aria-labelledby={id} className="flex shrink-0 overflow-hidden rounded-md border border-gray-300">
          {PERIODOS.map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={periodo === opcion}
              onClick={() => cambiar({ periodo: opcion })}
              className={`px-2.5 text-xs font-medium whitespace-nowrap ${
                periodo === opcion ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {ETIQUETAS_PERIODO[opcion]}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  )
}
