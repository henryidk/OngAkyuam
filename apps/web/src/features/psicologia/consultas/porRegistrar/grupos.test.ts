import { describe, expect, it } from 'vitest'
import type { SesionPorRegistrarDto } from '@akyuam/shared'
import { agruparPorRegistrar, textoAtraso } from './grupos'

// Datos ficticios. Las horas están en UTC (Guatemala = UTC-6).
function sesion(citaId: string, fechaHora: string): SesionPorRegistrarDto {
  return {
    citaId,
    procesoId: 'proceso-1',
    procesoCodigo: '05-2026.01',
    usuariaNombreCompleto: 'Usuaria Ficticia',
    persona: { ninoId: null, nombreCompleto: 'Usuaria Ficticia', edad: 30 },
    fechaHora,
    duracionMinutos: 45,
    tipo: 'SEGUIMIENTO',
    borrador: false,
  }
}

describe('agruparPorRegistrar', () => {
  const HOY = '2026-10-07'

  it('separa las de hoy de las atrasadas con su antigüedad en días', () => {
    const grupos = agruparPorRegistrar(
      [
        sesion('antigua', '2026-10-02T15:00:00.000Z'),
        sesion('ayer', '2026-10-06T15:00:00.000Z'),
        sesion('hoy', '2026-10-07T15:00:00.000Z'),
      ],
      HOY,
    )

    expect(grupos.hoy.map((s) => s.citaId)).toEqual(['hoy'])
    expect(grupos.atrasadas.map(({ sesion: s, dias }) => [s.citaId, dias])).toEqual([
      ['ayer', 1],
      ['antigua', 5],
    ])
  })

  it('usa el día de Guatemala: anoche a las 23:00 ya es atrasada aunque en UTC sea hoy', () => {
    const grupos = agruparPorRegistrar([sesion('anoche', '2026-10-07T05:00:00.000Z')], HOY)

    expect(grupos.hoy).toEqual([])
    expect(grupos.atrasadas[0]?.dias).toBe(1)
  })

  it('dice la antigüedad en texto', () => {
    expect(textoAtraso(1)).toBe('ayer')
    expect(textoAtraso(4)).toBe('hace 4 días')
  })
})
