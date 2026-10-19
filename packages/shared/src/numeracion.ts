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
