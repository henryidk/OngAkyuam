/** Código visible de una atención médica, "M{consecutivo}-{número de expediente}". Se deriva, no se guarda. */
export function codigoAtencion(
  consecutivo: number,
  expedienteNumero: string,
): string {
  return `M${consecutivo}-${expedienteNumero}`;
}
