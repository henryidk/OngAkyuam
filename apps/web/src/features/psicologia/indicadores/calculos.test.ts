import { describe, expect, it } from 'vitest'
import { porcentajeInasistencia, proporcion } from './calculos'

describe('porcentajeInasistencia', () => {
  it('se calcula sobre las citas atendidas más las inasistencias', () => {
    expect(porcentajeInasistencia({ sesionesRealizadas: 3, inasistencias: 1 })).toBe(25)
  })

  it('es 0 cuando todavía no hay citas concluidas', () => {
    expect(porcentajeInasistencia({ sesionesRealizadas: 0, inasistencias: 0 })).toBe(0)
  })
})

describe('proporcion', () => {
  it('es el porcentaje respecto al valor más grande', () => {
    expect(proporcion(2, 8)).toBe(25)
  })

  it('es 0 si la serie está vacía', () => {
    expect(proporcion(0, 0)).toBe(0)
  })
})
