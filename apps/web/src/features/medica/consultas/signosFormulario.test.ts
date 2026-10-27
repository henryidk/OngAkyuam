import { describe, expect, it } from 'vitest'
import { filtrarSigno } from './signosFormulario'

describe('filtrarSigno', () => {
  it('en los signos enteros descarta letras, signos y decimales', () => {
    expect(filtrarSigno('frecuenciaResp', '1a8')).toBe('18')
    expect(filtrarSigno('frecuenciaCardiaca', '80.5')).toBe('805')
    expect(filtrarSigno('glucosaMgDl', '-95 mg')).toBe('95')
    expect(filtrarSigno('saturacionO2', '1000')).toBe('100')
  })

  it('en temperatura, peso y talla admite un solo separador y los decimales del rango', () => {
    expect(filtrarSigno('temperaturaC', '36,5')).toBe('36,5')
    expect(filtrarSigno('temperaturaC', '36.55')).toBe('36.5')
    expect(filtrarSigno('pesoKg', '60.2.5')).toBe('60.25')
    expect(filtrarSigno('tallaM', 'e1.55')).toBe('1.55')
    expect(filtrarSigno('tallaM', '1.')).toBe('1.')
  })

  it('en la presión admite cifras y una sola "/"', () => {
    expect(filtrarSigno('presionArterial', '120/80')).toBe('120/80')
    expect(filtrarSigno('presionArterial', '120/')).toBe('120/')
    expect(filtrarSigno('presionArterial', '12a0/8/0')).toBe('120/80')
    expect(filtrarSigno('presionArterial', '1200')).toBe('120')
  })

  it('vacío queda vacío', () => {
    expect(filtrarSigno('pesoKg', '')).toBe('')
    expect(filtrarSigno('presionArterial', 'abc')).toBe('')
  })
})
