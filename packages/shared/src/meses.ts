/** Los meses del año como números de calendario: 1 = enero … 12 = diciembre. */
export const MESES_DEL_ANIO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

export const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

/** Nombre del mes (1-12). */
export function nombreMes(mes: number): string {
  return NOMBRES_MES[mes - 1] ?? String(mes)
}

/** Abreviatura de tres letras para ejes de gráficas ("Ene", "Feb"…). */
export function nombreMesCorto(mes: number): string {
  return nombreMes(mes).slice(0, 3)
}

/**
 * Serie de los 12 meses, siempre de enero a diciembre: los que no traen dato salen con `vacio`.
 * Así una tabla o una gráfica mensual nunca cambia de orden ni pierde columnas.
 */
export function serieDoceMeses<T>(porMes: ReadonlyMap<number, T>, vacio: (mes: number) => T): T[] {
  return MESES_DEL_ANIO.map((mes) => porMes.get(mes) ?? vacio(mes))
}

/** Años consecutivos desde `primero` hasta `ultimo`, del más reciente al más antiguo. */
export function aniosEntre(primero: number, ultimo: number): number[] {
  const anios: number[] = []
  for (let anio = ultimo; anio >= Math.min(primero, ultimo); anio -= 1) anios.push(anio)
  return anios
}
