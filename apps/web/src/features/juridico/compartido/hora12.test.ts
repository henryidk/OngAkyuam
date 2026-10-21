import { describe, expect, it } from 'vitest'
import { aHora12, aHora24, formatHora12 } from './hora12'

describe('hora de 12 horas', () => {
  it('convierte la mañana, la tarde y los extremos del mediodía y la medianoche', () => {
    expect(aHora12('10:00')).toEqual({ hora: 10, minutos: '00', periodo: 'AM' })
    expect(aHora12('13:05')).toEqual({ hora: 1, minutos: '05', periodo: 'PM' })
    expect(aHora12('12:30')).toEqual({ hora: 12, minutos: '30', periodo: 'PM' })
    expect(aHora12('00:15')).toEqual({ hora: 12, minutos: '15', periodo: 'AM' })
  })

  it('vuelve a "HH:mm" sin perder nada', () => {
    for (const hhmm of ['00:00', '00:15', '09:30', '11:55', '12:00', '12:30', '13:05', '23:55']) {
      expect(aHora24(aHora12(hhmm)!)).toBe(hhmm)
    }
  })

  it('rechaza lo que no es una hora', () => {
    expect(aHora12('')).toBeNull()
    expect(aHora12('24:00')).toBeNull()
    expect(aHora12('9:30')).toBeNull()
  })

  it('se lee como la dice el personal', () => {
    expect(formatHora12('10:00')).toBe('10:00 a. m.')
    expect(formatHora12('14:30')).toBe('2:30 p. m.')
    expect(formatHora12('12:00')).toBe('12:00 p. m.')
  })
})
