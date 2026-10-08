import type { PersonaAtendidaDto } from '@akyuam/shared'

/** "La usuaria" o "Nombre (N años)" para un hijo: así se nombra a quién se atiende en un caso. */
export function etiquetaPersona(persona: PersonaAtendidaDto): string {
  if (persona.ninoId === null) return 'La usuaria'
  return `${persona.nombreCompleto} (${persona.edad} años)`
}
