/** `%` y `_` son comodines de LIKE: lo que escribe la persona se busca literal. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}
