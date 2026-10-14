import type { PersonaAtendidaDto } from '@akyuam/shared'

export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto
}

/** Chip de la tarjeta de referencia: "Ana López (usuaria)" o "Kevin López, 7 años". */
export function etiquetaPersonaChip(persona: PersonaAtendidaDto): string {
  if (persona.ninoId === null) return `${persona.nombreCompleto} (usuaria)`
  return `${persona.nombreCompleto}, ${persona.edad} años`
}

/** Botón "¿A quién se atiende?": el nombre de la usuaria o "Kevin · 7 años". */
export function etiquetaPersonaBoton(persona: PersonaAtendidaDto): string {
  if (persona.ninoId === null) return persona.nombreCompleto
  return `${primerNombre(persona.nombreCompleto)} · ${persona.edad} años`
}

/** Clave de la persona en la URL del historial: "usuaria" o el id del hijo/a. */
export function clavePersona(persona: Pick<PersonaAtendidaDto, 'ninoId'>): string {
  return persona.ninoId ?? 'usuaria'
}
