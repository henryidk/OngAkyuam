/**
 * Ingreso por área: si la persona llega por primera vez en su vida a Jurídico, Psicología o
 * Médica, o si vuelve. Se guarda en la base por referencia (tabla `IngresoArea`, escrita solo por
 * triggers de la migración `ingreso_area`); las áreas solo lo leen. No va en ningún Excel.
 * Reemplaza al antiguo aviso "Ya atendida antes" de las bandejas.
 */
export const TIPOS_INGRESO_AREA = ['PRIMER_INGRESO', 'SEGUIMIENTO'] as const

export type TipoIngresoArea = (typeof TIPOS_INGRESO_AREA)[number]

export const ETIQUETAS_INGRESO_AREA: Record<TipoIngresoArea, string> = {
  PRIMER_INGRESO: 'Primer ingreso',
  SEGUIMIENTO: 'Seguimiento',
}
