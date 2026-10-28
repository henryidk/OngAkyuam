import type { PersonaAtendidaDto } from '@akyuam/shared'
import { etiquetaPersonaBoton } from './personas'

interface SelectorPersonaProps {
  personas: PersonaAtendidaDto[]
  ninoId: string | null
  onElegir: (ninoId: string | null) => void
  deshabilitado?: boolean
}

/** "¿A quién se atiende?": la usuaria o uno de sus hijos/as del expediente. */
export default function SelectorPersona({ personas, ninoId, onElegir, deshabilitado = false }: SelectorPersonaProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-[#1c2430]">¿A quién se atiende?</legend>
      <div className="flex flex-wrap gap-2">
        {personas.map((persona) => {
          const elegida = persona.ninoId === ninoId
          return (
            <button
              key={persona.ninoId ?? 'usuaria'}
              type="button"
              aria-pressed={elegida}
              disabled={deshabilitado && !elegida}
              onClick={() => onElegir(persona.ninoId)}
              className={`rounded-lg border-[1.5px] px-3 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                elegida
                  ? 'border-[#7346a5] bg-[#f2ecfa] text-[#5b3985]'
                  : 'border-[#e3e6ea] bg-white text-[#1c2430] hover:border-[#c7a8e5]'
              }`}
            >
              {etiquetaPersonaBoton(persona)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
