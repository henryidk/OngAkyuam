import type { PersonalDto } from '@akyuam/shared'

const GRUPOS: { tipo: string; etiqueta: string }[] = [
  { tipo: 'ABOGADA', etiqueta: 'Abogadas' },
  { tipo: 'PROCURADORA', etiqueta: 'Procuradoras' },
]

/** Opciones de un `<select>` de responsable, agrupadas por cargo; un grupo sin personas no se muestra. */
export default function OpcionesPersonal({ personal }: { personal: PersonalDto[] }) {
  return GRUPOS.map((grupo) => {
    const personas = personal.filter((persona) => persona.tipo === grupo.tipo)
    return (
      personas.length > 0 && (
        <optgroup key={grupo.tipo} label={grupo.etiqueta}>
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.activo ? persona.nombre : `${persona.nombre} (inactiva)`}
            </option>
          ))}
        </optgroup>
      )
    )
  })
}
