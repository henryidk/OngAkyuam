import { Check, Lock } from 'lucide-react'
import type { PersonaAtendidaDto } from '@akyuam/shared'
import { iniciales, primerNombre } from './personas'

interface SelectorPersonasCitaProps {
  personas: PersonaAtendidaDto[]
  /** Ids de las personas marcadas (null = la usuaria). */
  elegidas: (string | null)[]
  /** Primera consulta: todas van marcadas y no se pueden quitar. */
  obligatorias: boolean
  onCambiar: (elegidas: (string | null)[]) => void
}

/**
 * "Se atiende a": una casilla por persona del expediente (la usuaria y sus hijos/as). En la
 * primera consulta todas van marcadas y bloqueadas; en las siguientes cada una es opcional, con
 * al menos una marcada. Si se desmarca a la usuaria, la cita es solo de sus hijos/as y ella acompaña.
 */
export default function SelectorPersonasCita({ personas, elegidas, obligatorias, onCambiar }: SelectorPersonasCitaProps) {
  const usuaria = personas.find((persona) => persona.ninoId === null)
  const usuariaAcompana = usuaria !== undefined && !elegidas.includes(null) && elegidas.length > 0

  function alternar(ninoId: string | null) {
    if (obligatorias) return
    const marcada = elegidas.includes(ninoId)
    if (marcada && elegidas.length === 1) return // Siempre queda al menos una persona.
    // Se conserva el orden del expediente (usuaria primero) para que la confirmación se lea igual.
    const siguiente = personas
      .map((persona) => persona.ninoId)
      .filter((id) => (id === ninoId ? !marcada : elegidas.includes(id)))
    onCambiar(siguiente)
  }

  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-[13px] font-medium text-[#1c2430]">
        <span>Se atiende a</span>
        <span className="text-[12px] font-normal text-[#5b6573]">
          {elegidas.length} de {personas.length}
        </span>
      </legend>
      <div className="overflow-hidden rounded-lg border border-[#e3e6ea] bg-white">
        {personas.map((persona) => {
          const marcada = elegidas.includes(persona.ninoId)
          const unica = marcada && elegidas.length === 1
          const bloqueada = obligatorias || unica
          const esUsuaria = persona.ninoId === null
          return (
            <label
              key={persona.ninoId ?? 'usuaria'}
              title={unica && !obligatorias ? 'Debe quedar al menos una persona' : undefined}
              className={`flex items-center gap-3 border-b border-[#eef0f2] px-3 py-2 last:border-b-0 ${
                bloqueada ? 'cursor-default' : 'cursor-pointer hover:bg-[#faf7fd]'
              } ${marcada ? '' : 'bg-[#fbfbfc]'}`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={marcada}
                disabled={bloqueada}
                onChange={() => alternar(persona.ninoId)}
              />
              <span
                aria-hidden="true"
                className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded border-[1.5px] peer-focus-visible:ring-2 peer-focus-visible:ring-[#c7a8e5] ${
                  marcada ? 'border-[#7346a5] bg-[#7346a5] text-white' : 'border-[#c9ced5] bg-white'
                } ${obligatorias ? 'opacity-70' : ''}`}
              >
                {marcada && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11.5px] font-semibold ${
                  marcada ? 'bg-[#f2ecfa] text-[#5b3985]' : 'bg-[#f0f2f4] text-[#7a8494]'
                }`}
              >
                {iniciales(persona.nombreCompleto)}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[13.5px] font-medium ${marcada ? 'text-[#1c2430]' : 'text-[#5b6573]'}`}>
                  {esUsuaria ? persona.nombreCompleto : primerNombre(persona.nombreCompleto)}
                </span>
                <span className="block text-[12px] text-[#5b6573]">
                  {esUsuaria ? (usuariaAcompana ? 'Usuaria · solo acompaña' : 'Usuaria') : `Hijo/a · ${persona.edad} años`}
                </span>
              </span>
              {obligatorias && (
                <span className="flex flex-none items-center gap-1 rounded-full bg-[#f2ecfa] px-2 py-0.5 text-[11px] font-semibold text-[#5b3985]">
                  <Lock aria-hidden="true" className="h-3 w-3" />
                  Primera consulta
                </span>
              )}
            </label>
          )
        })}
      </div>
      <p className="mt-1.5 text-[12px] text-[#5b6573]">
        {obligatorias
          ? 'La primera consulta es para la usuaria y todos sus hijos/as.'
          : usuariaAcompana && usuaria
            ? `Cita solo de los hijos/as: ${primerNombre(usuaria.nombreCompleto)} acompaña.`
            : 'Marca a quienes se atienden en esta visita.'}
      </p>
    </fieldset>
  )
}
