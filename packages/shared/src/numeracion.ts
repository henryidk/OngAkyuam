/**
 * No. interno visible de lo que cada área abre dentro de un expediente (planaudiencias.md §3).
 *
 * El número de expediente que asigna Trabajo Social ("10-2026") es el mismo en todas las áreas:
 * no lleva letra de área. Cuando un expediente tiene más de un proceso (o atención) en la misma
 * área, a partir del segundo se agrega su número: "10-2026 · Proceso 2". Se deriva al mostrar;
 * en la base solo existen `Expediente.numero` y el `consecutivo` de cada área.
 */

/**
 * Número de expediente que asigna Trabajo Social: el consecutivo del año con al menos dos
 * dígitos y el año ("05-2026", "100-2026"). La base exige esta forma
 * (`Expediente_numero_formato_chk`).
 */
export function formatoNumeroExpediente(consecutivo: number, anio: number): string {
  return `${String(consecutivo).padStart(2, '0')}-${anio}`
}

/**
 * Normaliza un número de expediente escrito a mano: "5-2026" → "05-2026". `null` si no tiene
 * la forma número-año.
 */
export function normalizarNumeroExpediente(texto: string): string | null {
  const partes = /^(\d+)-(\d{4})$/.exec(texto.trim())
  return partes ? formatoNumeroExpediente(Number(partes[1]), Number(partes[2])) : null
}

const SEPARADOR_CODIGO = ' · '

/**
 * Separa un código visible en el número (de expediente o de persona) y la unidad de área:
 * "05-2026 · Proceso 2" → { numero: "05-2026", unidad: "Proceso 2" };
 * "04-2026.01" → { numero: "04-2026.01", sufijoPersona: ".01", unidad: null }.
 */
export function partesCodigo(codigo: string): {
  numero: string
  unidad: string | null
  sufijoPersona: string | null
} {
  const corte = codigo.indexOf(SEPARADOR_CODIGO)
  const numero = corte === -1 ? codigo : codigo.slice(0, corte)
  const unidad = corte === -1 ? null : codigo.slice(corte + SEPARADOR_CODIGO.length)
  const persona = /\.\d+$/.exec(numero)
  return { numero, unidad, sufijoPersona: persona ? persona[0] : null }
}

/**
 * Un código dentro de una frase, sin repetir la palabra: "Proceso 04-2026" para el primero y
 * "04-2026 · Proceso 2" (no "Proceso 04-2026 · Proceso 2") desde el segundo.
 */
export function textoCodigo(palabra: 'Proceso' | 'Atención', codigo: string): string {
  return partesCodigo(codigo).unidad === null ? `${palabra} ${codigo}` : codigo
}

function etiqueta(unidad: string, expedienteNumero: string, consecutivo: number): string {
  return consecutivo > 1
    ? `${expedienteNumero}${SEPARADOR_CODIGO}${unidad} ${consecutivo}`
    : expedienteNumero
}

/** Proceso jurídico o psicológico: "10-2026", "10-2026 · Proceso 2". */
export function etiquetaProceso(expedienteNumero: string, consecutivo: number): string {
  return etiqueta('Proceso', expedienteNumero, consecutivo)
}

/** Número de un hijo/a dentro del expediente de la madre: "04-2026.01". Es estable: no cambia. */
export function numeroPersona(expedienteNumero: string, ninoConsecutivo: number | null): string {
  return ninoConsecutivo === null
    ? expedienteNumero
    : `${expedienteNumero}.${String(ninoConsecutivo).padStart(2, '0')}`
}

/**
 * Proceso psicológico: cada persona del expediente (la usuaria y cada hijo/a) lleva sus propios
 * procesos. "04-2026", "04-2026 · Proceso 2", "04-2026.01", "04-2026.01 · Proceso 2".
 */
export function etiquetaProcesoPsicologia(
  expedienteNumero: string,
  consecutivo: number,
  ninoConsecutivo: number | null,
): string {
  return etiquetaProceso(numeroPersona(expedienteNumero, ninoConsecutivo), consecutivo)
}

/** Atención médica: "10-2026", "10-2026 · Atención 2". */
export function etiquetaAtencion(expedienteNumero: string, consecutivo: number): string {
  return etiqueta('Atención', expedienteNumero, consecutivo)
}

export interface NumeroInternoBuscado {
  expedienteNumero: string
  consecutivo: number
}

/** Palabra de la unidad de cada área en el No. interno: Jurídico y Psicología abren procesos. */
export type UnidadNumeroInterno = 'proceso' | 'atencion'

const PALABRA_UNIDAD: Record<UnidadNumeroInterno, string> = {
  proceso: 'proceso',
  atencion: 'atenci[oó]n',
}

/**
 * Separa un término de búsqueda que trae el No. interno completo en expediente + consecutivo,
 * para que la búsqueda lo encuentre aunque en la base solo existan `Expediente.numero` y el
 * `consecutivo` (planaudiencias.md §3.2, H1). Acepta lo que la operadora copia de la pantalla
 * o escribe a mano: sin punto medio, sin tilde o sin el cero ("5-2026 proceso 2" →
 * "05-2026", 2). Solo la palabra de la unidad del área que busca: en Jurídico, "Proceso".
 * `null` si el término no tiene esa forma: entonces se busca como texto normal.
 */
export function separarNumeroInterno(
  termino: string,
  unidad: UnidadNumeroInterno = 'proceso',
): NumeroInternoBuscado | null {
  const patron = new RegExp(
    `^(\\d+)-(\\d{4})\\s*(?:·\\s*)?${PALABRA_UNIDAD[unidad]}\\s+(\\d+)$`,
    'i',
  )
  const coincidencia = patron.exec(termino.trim())
  if (!coincidencia) return null
  const consecutivo = Number(coincidencia[3])
  return consecutivo >= 1
    ? {
        expedienteNumero: formatoNumeroExpediente(Number(coincidencia[1]), Number(coincidencia[2])),
        consecutivo,
      }
    : null
}
