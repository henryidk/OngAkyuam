import { describe, expect, it } from 'vitest'
import { enHorarioOficina, franjaHora, msHastaSiguienteHora } from './programacion'

describe('msHastaSiguienteHora', () => {
  it('cuenta hasta la próxima hora en punto', () => {
    expect(msHastaSiguienteHora(Date.parse('2026-11-03T14:59:30.000Z'))).toBe(30_000)
    expect(msHastaSiguienteHora(Date.parse('2026-11-03T14:00:00.000Z'))).toBe(3_600_000)
  })
})

describe('franjaHora', () => {
  it('usa la fecha y la hora de Guatemala, no las de UTC', () => {
    // 03/11 05:30 UTC = 02/11 23:30 en Guatemala.
    expect(franjaHora(new Date('2026-11-03T05:30:00.000Z'))).toBe('2026-11-02T23')
  })
})

describe('enHorarioOficina', () => {
  // Guatemala = UTC-6: 8:00 GT = 14:00 UTC; 17:00 GT = 23:00 UTC. 2026-11-03 es martes.
  it('de 8:00 a 16:59 en Guatemala sí avisa', () => {
    expect(enHorarioOficina(new Date('2026-11-03T14:00:00.000Z'))).toBe(true)
    expect(enHorarioOficina(new Date('2026-11-03T22:00:00.000Z'))).toBe(true)
    expect(enHorarioOficina(new Date('2026-11-03T22:59:00.000Z'))).toBe(true)
  })

  it('antes de las 8:00 y desde las 17:00 no avisa, aunque en UTC sea otro día', () => {
    expect(enHorarioOficina(new Date('2026-11-03T13:59:00.000Z'))).toBe(false)
    expect(enHorarioOficina(new Date('2026-11-03T23:00:00.000Z'))).toBe(false)
    // 04/11 03:00 UTC = 03/11 21:00 en Guatemala.
    expect(enHorarioOficina(new Date('2026-11-04T03:00:00.000Z'))).toBe(false)
  })
})

describe('enHorarioOficina los fines de semana', () => {
  it('sábado y domingo no avisa, aunque sea en horario', () => {
    expect(enHorarioOficina(new Date('2026-11-07T16:00:00.000Z'))).toBe(false) // sábado 10:00 GT
    expect(enHorarioOficina(new Date('2026-11-08T16:00:00.000Z'))).toBe(false) // domingo 10:00 GT
  })

  it('el día es el de Guatemala: viernes 16:30 GT avisa y el lunes a las 8:00 vuelve', () => {
    // Viernes 06/11 16:30 GT = 22:30 UTC, todavía viernes en ambos.
    expect(enHorarioOficina(new Date('2026-11-06T22:30:00.000Z'))).toBe(true)
    expect(enHorarioOficina(new Date('2026-11-09T14:00:00.000Z'))).toBe(true) // lunes 8:00 GT
  })
})
