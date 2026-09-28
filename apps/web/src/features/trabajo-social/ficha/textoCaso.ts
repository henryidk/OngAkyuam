import {
  ETIQUETAS_GENERO,
  ETIQUETAS_TIPOLOGIA_DELITO,
  edadEnAniosGT,
  type ExpedienteDetalleCaso,
  type Nino,
} from '@akyuam/shared'

export function textoTipologia(detalle: ExpedienteDetalleCaso): string {
  if (detalle.tipologiaDelito.length === 0) return '—'
  return detalle.tipologiaDelito
    .map((tipo) => ETIQUETAS_TIPOLOGIA_DELITO[tipo as keyof typeof ETIQUETAS_TIPOLOGIA_DELITO] ?? tipo)
    .join(', ')
}

export function textoAgresor(detalle: ExpedienteDetalleCaso): string {
  const agresor = detalle.agresor
  if (!agresor) return 'Sin datos'
  const nombre = [agresor.nombres, agresor.apellidos].filter(Boolean).join(' ')
  return nombre || 'Sin nombre registrado'
}

export function textoNino(nino: Nino): string {
  const edad = edadEnAniosGT(nino.fechaNacimiento)
  return `${nino.nombres} ${nino.apellidos} · ${ETIQUETAS_GENERO[nino.genero]} · ${edad} ${edad === 1 ? 'año' : 'años'}`
}
