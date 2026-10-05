import { MAX_SUGERENCIAS_TIPO_ACTUACION } from '@akyuam/shared';

/**
 * Une las sugerencias del propio proceso (van primero) con las de procesos del mismo tipo, sin
 * repetir tipos que solo difieren en mayúsculas, hasta el máximo.
 */
export function combinarSugerencias(
  delProceso: string[],
  delTipoDeProceso: string[],
): string[] {
  const vistos = new Set<string>();
  const resultado: string[] = [];
  for (const tipo of [...delProceso, ...delTipoDeProceso]) {
    const clave = tipo.toLocaleLowerCase('es');
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(tipo);
    if (resultado.length === MAX_SUGERENCIAS_TIPO_ACTUACION) break;
  }
  return resultado;
}
