/** Palabras que van en minúscula dentro de un nombre ("María de los Ángeles"), salvo al inicio. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y'])

function tieneMayusculasMixtas(palabra: string): boolean {
  const resto = palabra.slice(1)
  return resto !== resto.toLocaleLowerCase('es') && palabra !== palabra.toLocaleUpperCase('es')
}

function capitalizar(palabra: string): string {
  return palabra.charAt(0).toLocaleUpperCase('es') + palabra.slice(1).toLocaleLowerCase('es')
}

function normalizarPalabra(palabra: string, esPrimera: boolean): string {
  const minuscula = palabra.toLocaleLowerCase('es')
  if (!esPrimera && PARTICULAS.has(minuscula)) return minuscula
  // "McDonald" o "DeLeón" ya traen una grafía deliberada: se respetan tal cual.
  if (tieneMayusculasMixtas(palabra)) return palabra
  return palabra.split('-').map(capitalizar).join('-')
}

/**
 * Deja un nombre o apellido de persona como se escribe: sin espacios de más y con mayúscula
 * inicial en cada palabra ("  angie   TRINIDAD " → "Angie Trinidad", "maría de los ángeles" →
 * "María de los Ángeles"). Aplicarla dos veces da el mismo resultado.
 */
export function normalizarNombrePropio(texto: string): string {
  return texto
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((palabra, indice) => normalizarPalabra(palabra, indice === 0))
    .join(' ')
}
