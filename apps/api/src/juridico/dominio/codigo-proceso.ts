/** Código visible del proceso: "J2-05-2026" = segundo proceso del expediente 05-2026. */
export function codigoProceso(
  consecutivo: number,
  numeroExpediente: string,
): string {
  return `J${consecutivo}-${numeroExpediente}`;
}
