import {
  errorSignoVital,
  parsearPresionArterial,
  SIGNOS_VITALES_FORMULARIO,
  SIGNOS_VITALES_VACIOS,
  type CampoSignoFormulario,
  type SignosVitalesDto,
} from '@akyuam/shared'

/** Lo que la médica escribe en cada casilla, tal cual (texto): se convierte al guardar. */
export type ValoresSignos = Record<CampoSignoFormulario, string>

export function signosVacios(tallaM: number | null): ValoresSignos {
  const valores = Object.fromEntries(SIGNOS_VITALES_FORMULARIO.map(({ clave }) => [clave, ''])) as ValoresSignos
  if (tallaM !== null) valores.tallaM = String(tallaM)
  return valores
}

/** Acepta coma o punto decimal ("36,5"). Vacío = no se tomó. */
function leerNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  return limpio === '' ? null : Number(limpio)
}

/**
 * Convierte las casillas a `SignosVitalesDto` y devuelve el error de cada casilla con los mismos
 * rangos que valida el backend. La presión es una sola casilla "120/80".
 */
export function leerSignos(valores: ValoresSignos): {
  signos: SignosVitalesDto
  errores: Partial<Record<CampoSignoFormulario, string>>
} {
  const signos: SignosVitalesDto = { ...SIGNOS_VITALES_VACIOS }
  const errores: Partial<Record<CampoSignoFormulario, string>> = {}

  for (const { clave } of SIGNOS_VITALES_FORMULARIO) {
    if (clave === 'presionArterial') {
      const presion = parsearPresionArterial(valores.presionArterial)
      if (presion === 'invalida') {
        errores.presionArterial = 'Escríbela así: 120/80'
      } else if (presion) {
        const error =
          errorSignoVital('presionSistolica', presion.sistolica) ?? errorSignoVital('presionDiastolica', presion.diastolica)
        if (error) errores.presionArterial = error
        signos.presionSistolica = presion.sistolica
        signos.presionDiastolica = presion.diastolica
      }
      continue
    }
    const numero = leerNumero(valores[clave])
    const error = errorSignoVital(clave, numero)
    if (error) errores[clave] = error
    else signos[clave] = numero
  }
  return { signos, errores }
}
