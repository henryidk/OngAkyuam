import { SIGNOS_VITALES_FORMULARIO, type CampoSignoFormulario, type SignosVitalesDto } from '@akyuam/shared'

/** Valor de un signo tal como se muestra; la presión es un solo valor "120/80". */
export function valorSigno(signos: SignosVitalesDto, clave: CampoSignoFormulario): string | null {
  if (clave === 'presionArterial') {
    return signos.presionSistolica === null ? null : `${signos.presionSistolica}/${signos.presionDiastolica}`
  }
  const valor = signos[clave]
  return valor === null ? null : String(valor)
}

export function haySignos(signos: SignosVitalesDto): boolean {
  return SIGNOS_VITALES_FORMULARIO.some(({ clave }) => valorSigno(signos, clave) !== null)
}
