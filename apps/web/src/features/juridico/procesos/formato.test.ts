import { describe, expect, it } from 'vitest'
import type { ProximaAudienciaDto } from '@akyuam/shared'
import { anioDesdeUrl, opcionesCarpetas, textoProximaAudiencia } from './formato'

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
      aviso: 'Falta registrar resultado',
      pendiente: true,
    })
  })
})

describe('anioDesdeUrl', () => {
  it('lee el año de la carpeta', () => {
    expect(anioDesdeUrl('2014')).toBe(2014)
  })

  it('un valor ausente, inválido o fuera de rango es "Todos"', () => {
    expect(anioDesdeUrl(null)).toBeNull()
    expect(anioDesdeUrl('')).toBeNull()
    expect(anioDesdeUrl('seguimiento')).toBeNull()
    expect(anioDesdeUrl('1850')).toBeNull()
    expect(anioDesdeUrl('2014.5')).toBeNull()
  })
})

describe('opcionesCarpetas', () => {
  const resumen = {
    enTramite: 42,
    enTramitePorAnio: [
      { anio: 2025, total: 12 },
      { anio: 2014, total: 2 },
      { anio: 2026, total: 28 },
    ],
  }

  it('ordena de la más reciente a la más antigua con los totales del resumen', () => {
    const opciones = opcionesCarpetas(2026, resumen, { anioElegido: null, conTotales: true })
    expect(opciones.todos).toBe(42)
    expect(opciones.carpetas.map((c) => [c.anio, c.total, c.esAnioActual])).toEqual([
      [2026, 28, true],
      [2025, 12, false],
      [2014, 2, false],
    ])
  })

  it('el año en curso y el elegido aparecen aunque no tengan procesos', () => {
    const opciones = opcionesCarpetas(2027, resumen, { anioElegido: 2010, conTotales: true })
    expect(opciones.carpetas.map((c) => [c.anio, c.total])).toEqual([
      [2027, 0],
      [2026, 28],
      [2025, 12],
      [2014, 2],
      [2010, 0],
    ])
  })

  it('con la lista acotada o sin resumen no inventa números', () => {
    const acotada = opcionesCarpetas(2026, resumen, { anioElegido: null, conTotales: false })
    expect(acotada.todos).toBeNull()
    expect(acotada.carpetas.every((c) => c.total === null)).toBe(true)
    expect(opcionesCarpetas(2026, null, { anioElegido: null, conTotales: true }).carpetas).toEqual([
      { anio: 2026, total: null, esAnioActual: true },
    ])
  })
})
