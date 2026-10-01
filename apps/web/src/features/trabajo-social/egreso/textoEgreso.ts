/** `convenio`: si se adjuntó el Convenio de egreso junto con la fecha y qué pasó con esa subida. */
export interface ResultadoEgreso {
  convenio: 'NO_ADJUNTO' | 'SUBIDO' | 'FALLO'
}

const TEXTOS_EGRESO_REGISTRADO: Record<ResultadoEgreso['convenio'], string> = {
  NO_ADJUNTO: 'Egreso registrado · el Convenio de egreso queda pendiente',
  SUBIDO: 'Egreso registrado · Convenio de egreso subido',
  FALLO: 'Egreso registrado · el convenio no se pudo subir, súbelo desde Documentos',
}

export function textoEgresoRegistrado(resultado: ResultadoEgreso): string {
  return TEXTOS_EGRESO_REGISTRADO[resultado.convenio]
}
