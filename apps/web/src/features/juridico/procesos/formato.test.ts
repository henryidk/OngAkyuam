import { describe, expect, it } from 'vitest'
import type { ProximaAudienciaDto } from '@akyuam/shared'
import { carteraAUrl, carteraDesdeUrl, opcionesCartera, textoProximaAudiencia } from './formato'

const HOY = '2026-10-20'

function proxima(fecha: string, estadoVisible: ProximaAudienciaDto['estadoVisible'] = 'PROXIMA'): ProximaAudienciaDto {
  return { id: 'a1', inicio: `${fecha}T15:30:00.000Z`, fecha, hora: '09:30', estadoVisible }
}

describe('textoProximaAudiencia', () => {
  it('dice Hoy, Mañana o en cuántos días', () => {
    expect(textoProximaAudiencia(proxima(HOY, 'HOY'), HOY)).toEqual({ aviso: 'Hoy', pendiente: false })
    expect(textoProximaAudiencia(proxima('2026-10-21'), HOY)).toEqual({ aviso: 'Mañana', pendiente: false })
    expect(textoProximaAudiencia(proxima('2026-10-27'), HOY)).toEqual({ aviso: 'En 7 días', pendiente: false })
  })

  it('cruza el fin de mes y de año por días de calendario', () => {
    expect(textoProximaAudiencia(proxima('2027-01-02'), '2026-12-31').aviso).toBe('En 2 días')
  })

  it('una vencida sin resultado se marca como pendiente', () => {
    expect(textoProximaAudiencia(proxima('2026-10-13', 'PENDIENTE_RESULTADO'), HOY)).toEqual({
      aviso: 'Pendiente de resultado',
      pendiente: true,
    })
  })
})

describe('cartera en la URL', () => {
  it('ida y vuelta, con "Todos" sin parámetro', () => {
    expect(carteraAUrl('TODOS')).toBeNull()
    expect(carteraAUrl('ANIO')).toBe('anio')
    expect(carteraDesdeUrl('anio')).toBe('ANIO')
    expect(carteraDesdeUrl('seguimiento')).toBe('SEGUIMIENTO')
  })

  it('un valor desconocido o ausente es "Todos"', () => {
    expect(carteraDesdeUrl(null)).toBe('TODOS')
    expect(carteraDesdeUrl('2024')).toBe('TODOS')
  })
})

describe('opcionesCartera', () => {
  it('etiqueta el año en curso y toma los totales del resumen', () => {
    const opciones = opcionesCartera(2026, { enTramite: 42, enTramitePorCartera: { anio: 30, seguimiento: 12 } })
    expect(opciones.map((opcion) => [opcion.etiqueta, opcion.total])).toEqual([
      ['Todos', 42],
      ['Año en curso 2026', 30],
      ['Seguimiento', 12],
    ])
  })

  it('sin resumen no inventa números', () => {
    expect(opcionesCartera(2026, null).every((opcion) => opcion.total === null)).toBe(true)
  })
})
