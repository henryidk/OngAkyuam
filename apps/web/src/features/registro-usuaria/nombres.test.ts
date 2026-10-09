import { describe, expect, it } from 'vitest'
import { datosAgresorSchema, ninoSchema, normalizarNombrePropio } from '@akyuam/shared'

describe('normalizarNombrePropio', () => {
  it.each([
    ['angie trinidad', 'Angie Trinidad'],
    ['  ANGIE    TRINIDAD ', 'Angie Trinidad'],
    ['maría de los ángeles', 'María de los Ángeles'],
    ['JUANA DEL CARMEN Y ROSA', 'Juana del Carmen y Rosa'],
    ['de león', 'De León'],
    ['ñandú ÁVILA', 'Ñandú Ávila'],
    ['ana-maría', 'Ana-María'],
    ['McDonald', 'McDonald'],
    ['', ''],
    ['   ', ''],
  ])('%j → %j', (entrada, esperado) => {
    expect(normalizarNombrePropio(entrada)).toBe(esperado)
  })

  it('aplicarla dos veces no cambia el resultado', () => {
    const una = normalizarNombrePropio('  maRIA  DE la  cruz ')
    expect(normalizarNombrePropio(una)).toBe(una)
  })
})

describe('schemas de registro', () => {
  const nino = { fechaNacimiento: '2020-01-15', genero: 'M' }

  it('guardan los nombres ya normalizados', () => {
    const resultado = ninoSchema.parse({ ...nino, nombres: ' ana  LUCÍA ', apellidos: 'de la cruz' })
    expect(resultado).toMatchObject({ nombres: 'Ana Lucía', apellidos: 'De la Cruz' })
  })

  it('rechazan un nombre obligatorio hecho solo de espacios', () => {
    expect(ninoSchema.safeParse({ ...nino, nombres: '   ', apellidos: 'Cruz' }).success).toBe(false)
  })

  it('dejan vacío el nombre del agresor cuando no se conoce', () => {
    const resultado = datosAgresorSchema.parse({ nombres: '', apellidos: ' pérez ', telefono: '', direccion: '' })
    expect(resultado).toMatchObject({ nombres: '', apellidos: 'Pérez' })
  })
})
