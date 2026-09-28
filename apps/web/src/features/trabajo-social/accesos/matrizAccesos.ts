import type { AreaAtencion, FilaMatrizAccesos, MatrizAccesos } from '@akyuam/shared'

export type ClaveFilaAcceso = FilaMatrizAccesos['clave']

/** Copia de la matriz con una sola celda cambiada — base de la actualización optimista y de su rollback. */
export function conCeldaCambiada(
  matriz: MatrizAccesos,
  clave: ClaveFilaAcceso,
  area: AreaAtencion,
  visible: boolean,
): MatrizAccesos {
  return {
    ...matriz,
    filas: matriz.filas.map((fila) =>
      fila.clave === clave
        ? { ...fila, celdas: { ...fila.celdas, [area]: { ...fila.celdas[area], visible } } }
        : fila,
    ),
  }
}

/** Cuerpo del `PUT` para una celda: la fila de datos del caso o un tipo de documento. */
export function cambioDeCelda(clave: ClaveFilaAcceso, visible: boolean) {
  return clave === 'DATOS_CASO' ? { datosCaso: visible } : { documentos: { [clave]: visible } }
}
