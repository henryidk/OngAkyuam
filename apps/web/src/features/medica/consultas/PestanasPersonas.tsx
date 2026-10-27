import { Check } from 'lucide-react'
import type { PersonaConsultaMedicaDto } from '@akyuam/shared'
import { clavePersona, iniciales, primerNombre } from '../compartido/personas'

/** Cómo va el registro de una persona: lista para guardar, empezada, sin tocar o le falta algo. */
export type EstadoPestana = 'lista' | 'en-curso' | 'vacia' | 'falta'

interface PestanasPersonasProps {
  personas: PersonaConsultaMedicaDto[]
  activa: string
  estados: Record<string, EstadoPestana>
  onElegir: (clave: string) => void
}

const DESCRIPCION_ESTADO: Record<EstadoPestana, string> = {
  lista: 'lista',
  'en-curso': 'en curso',
  vacia: 'sin empezar',
  falta: 'le falta información',
}

/**
 * Una pestaña por persona de la visita: cada una se registra por separado y se guardan todas
 * juntas. El indicador del círculo dice cuál está lista (✓), cuál va a medias y cuál falta.
 */
export default function PestanasPersonas({ personas, activa, estados, onElegir }: PestanasPersonasProps) {
  const listas = personas.filter((persona) => estados[clavePersona(persona)] === 'lista').length

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-medium text-[#5b6573]">Personas de la visita</h2>
        <span
          aria-live="polite"
          className={`text-[12.5px] font-medium ${listas === personas.length ? 'text-[#2e7d4f]' : 'text-[#5b6573]'}`}
        >
          {listas} de {personas.length} {personas.length === 1 ? 'lista' : 'listas'}
        </span>
      </div>
      <div role="tablist" aria-label="Personas de la visita" className="flex gap-2 overflow-x-auto pb-1">
        {personas.map((persona) => {
          const clave = clavePersona(persona)
          const seleccionada = clave === activa
          const estado = estados[clave] ?? 'vacia'
          const esUsuaria = persona.ninoId === null
          return (
            <button
              key={clave}
              type="button"
              role="tab"
              id={`pestana-persona-${clave}`}
              aria-selected={seleccionada}
              aria-controls={`panel-persona-${clave}`}
              aria-label={`${persona.nombreCompleto}, ${DESCRIPCION_ESTADO[estado]}`}
              onClick={() => onElegir(clave)}
              className={`flex min-w-[168px] flex-none items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                seleccionada
                  ? 'border-[#7346a5] bg-[#f7f3fc] shadow-[0_0_0_1px_#7346a5]'
                  : 'border-[#e3e6ea] bg-white hover:border-[#c9b3e3]'
              }`}
            >
              <span className="relative flex-none">
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold ${
                    seleccionada ? 'bg-[#7346a5] text-white' : 'bg-[#f2ecfa] text-[#5b3985]'
                  }`}
                >
                  {iniciales(persona.nombreCompleto)}
                </span>
                <IndicadorEstado estado={estado} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-[#1c2430]">
                  {primerNombre(persona.nombreCompleto)}
                </span>
                <span className="block text-[12px] text-[#5b6573]">
                  {esUsuaria ? 'Usuaria' : `Hijo/a · ${persona.edad} años`}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function IndicadorEstado({ estado }: { estado: EstadoPestana }) {
  const base = 'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white'
  if (estado === 'lista') {
    return (
      <span aria-hidden="true" className={`${base} bg-[#2e7d4f] text-white`}>
        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
      </span>
    )
  }
  if (estado === 'en-curso') return <span aria-hidden="true" className={`${base} bg-[#d9a23a]`} />
  if (estado === 'falta') return <span aria-hidden="true" className={`${base} bg-[#d4574a]`} />
  return <span aria-hidden="true" className={`${base} bg-[#d5dadf]`} />
}
