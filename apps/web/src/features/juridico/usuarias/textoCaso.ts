import { ETIQUETAS_TIPOLOGIA_DELITO, type DatosCasoArea, type Nino } from '@akyuam/shared'

/** Lectura de los datos del caso de Trabajo Social para las pestañas de la ficha. */

export function textoTipologia(datosCaso: DatosCasoArea): string {
  return datosCaso.tipologiaDelito
    .map((tipo) => ETIQUETAS_TIPOLOGIA_DELITO[tipo as keyof typeof ETIQUETAS_TIPOLOGIA_DELITO] ?? tipo)
    .join(', ')
}

export function textoAgresor(datosCaso: DatosCasoArea): string | null {
  const agresor = datosCaso.agresor
  if (!agresor) return null
  const nombre = [agresor.nombres, agresor.apellidos].filter(Boolean).join(' ')
  return nombre || null
}

export function textoHijas(ninos: Nino[]): string {
  if (ninos.length === 0) return 'Ninguno registrado'
  return ninos.length === 1 ? '1 registrado' : `${ninos.length} registrados`
}
