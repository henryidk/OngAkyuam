/**
 * No. interno visible de lo que cada área abre dentro de un expediente (planaudiencias.md §3).
 *
 * El número de expediente que asigna Trabajo Social ("10-2026") es el mismo en todas las áreas:
 * no lleva letra de área. Cuando un expediente tiene más de un proceso (o atención) en la misma
 * área, a partir del segundo se agrega su número: "10-2026 · Proceso 2". Se deriva al mostrar;
 * en la base solo existen `Expediente.numero` y el `consecutivo` de cada área.
 */
function etiqueta(unidad: string, expedienteNumero: string, consecutivo: number): string {
  return consecutivo > 1 ? `${expedienteNumero} · ${unidad} ${consecutivo}` : expedienteNumero
}

/** Proceso jurídico o psicológico: "10-2026", "10-2026 · Proceso 2". */
export function etiquetaProceso(expedienteNumero: string, consecutivo: number): string {
  return etiqueta('Proceso', expedienteNumero, consecutivo)
}

/** Atención médica: "10-2026", "10-2026 · Atención 2". */
export function etiquetaAtencion(expedienteNumero: string, consecutivo: number): string {
  return etiqueta('Atención', expedienteNumero, consecutivo)
}

export interface NumeroInternoBuscado {
  expedienteNumero: string
  consecutivo: number
}

/**
 * "10-2026 · Proceso 2" acepta también sin punto medio o sin tilde ("10-2026 proceso 2",
 * "10-2026 · Atencion 2"): es lo que la operadora copia de la pantalla o escribe a mano.
 */
const PATRON_NUMERO_INTERNO = /^(\d+-\d{4})\s*(?:·\s*)?(?:proceso|atenci[oó]n)\s+(\d+)$/i

/**
 * Separa un término de búsqueda que trae el No. interno completo en expediente + consecutivo,
 * para que la búsqueda lo encuentre aunque en la base solo existan `Expediente.numero` y el
 * `consecutivo` (planaudiencias.md §3.2, H1). `null` si el término no tiene esa forma: entonces
 * se busca como texto normal (nombre, número de expediente suelto, No. judicial).
 */
export function separarNumeroInterno(termino: string): NumeroInternoBuscado | null {
  const coincidencia = PATRON_NUMERO_INTERNO.exec(termino.trim())
  if (!coincidencia) return null
  const consecutivo = Number(coincidencia[2])
  return consecutivo >= 1 ? { expedienteNumero: coincidencia[1], consecutivo } : null
}
