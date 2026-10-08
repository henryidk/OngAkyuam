/** Código visible del proceso: "P2-05-2026" = segundo proceso psicológico del expediente 05-2026. */
export function codigoProceso(
  consecutivo: number,
  numeroExpediente: string,
): string {
  return `P${consecutivo}-${numeroExpediente}`;
}
