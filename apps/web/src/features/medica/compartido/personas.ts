import type { PersonaAtendidaDto } from '@akyuam/shared'

export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? nombreCompleto
}

/** "AP" para el círculo de la persona: inicial del primer y segundo nombre. */
export function iniciales(nombreCompleto: string): string {
  const partes = nombreCompleto.trim().split(/\s+/)
  return `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}`.toUpperCase()
}

/** "Ana", "Ana y Luis" o "Ana, Luis y Sofía". */
export function listaPrimerosNombres(nombres: string[]): string {
  const primeros = nombres.map(primerNombre)
  if (primeros.length <= 1) return primeros.join('')
  return `${primeros.slice(0, -1).join(', ')} y ${primeros[primeros.length - 1]}`
}

/** Chip de la tarjeta de referencia: "Ana López (usuaria)" o "Kevin López, 7 años". */
export function etiquetaPersonaChip(persona: PersonaAtendidaDto): string {
  if (persona.ninoId === null) return `${persona.nombreCompleto} (usuaria)`
  return `${persona.nombreCompleto}, ${persona.edad} años`
}

/** Clave de la persona en la URL del historial: "usuaria" o el id del hijo/a. */
export function clavePersona(persona: Pick<PersonaAtendidaDto, 'ninoId'>): string {
  return persona.ninoId ?? 'usuaria'
}

/** "Luis, Sofía" o "Luis y Sofía": los primeros nombres de los hijos/as de una visita. */
function listaNombres(personas: PersonaAtendidaDto[]): string {
  return listaPrimerosNombres(personas.map((persona) => persona.nombreCompleto))
}

/**
 * Debajo del nombre de la usuaria en una fila de cita: quiénes más se atienden. `null` si la
 * visita es solo de la usuaria (no hace falta decir nada). "Con Luis y Sofía" o, si la madre solo
 * acompaña, "Consulta de Luis y Sofía · acompaña la madre".
 */
export function detallePersonasCita(personas: PersonaAtendidaDto[]): string | null {
  const hijos = personas.filter((persona) => persona.ninoId !== null)
  if (hijos.length === 0) return null
  const conUsuaria = personas.some((persona) => persona.ninoId === null)
  return conUsuaria ? `Con ${listaNombres(hijos)}` : `Consulta de ${listaNombres(hijos)} · acompaña la madre`
}
