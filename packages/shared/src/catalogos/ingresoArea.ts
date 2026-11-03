/**
 * Ingreso por área: si la persona llega por primera vez en su vida a Jurídico, Psicología o
 * Médica, o si vuelve. Se guarda en la base por referencia (tabla `IngresoArea`, escrita solo por
 * triggers de la migración `ingreso_area`); las áreas solo lo leen. No va en ningún Excel.
 *
 * Es distinto de "Ya atendida antes" de las bandejas: ese aviso dice que la usuaria ya tiene
 * procesos en el área; el ingreso dice si esta referencia es la primera que recibe el área.
 */
export const TIPOS_INGRESO_AREA = ['PRIMER_INGRESO', 'SEGUIMIENTO'] as const

export type TipoIngresoArea = (typeof TIPOS_INGRESO_AREA)[number]

export const ETIQUETAS_INGRESO_AREA: Record<TipoIngresoArea, string> = {
  PRIMER_INGRESO: 'Primer ingreso',
  SEGUIMIENTO: 'Seguimiento',
}
