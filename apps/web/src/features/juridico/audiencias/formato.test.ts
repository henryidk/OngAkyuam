import { describe, expect, it } from 'vitest'
import type { AudienciaOcupadaDto } from '@akyuam/shared'
import { agruparPorDia, audienciaEnHora, etiquetaDia, separarAcciones, textoEnlazada, textoEspera, textoFechaHora } from './formato'

// Datos ficticios. 2026-10-20 es martes.
const HOY = '2026-10-20'

describe('etiquetaDia', () => {
  it('hoy y mañana con palabra, el resto con la fecha larga', () => {
    expect(etiquetaDia(HOY, HOY)).toBe('Hoy')
    expect(etiquetaDia('2026-10-21', HOY)).toBe('Mañana')
    expect(etiquetaDia('2026-10-26', HOY)).toBe('Lunes 26 de octubre')
  })

  it('mañana cruza el fin de mes sin rollover', () => {
    expect(etiquetaDia('2026-11-01', '2026-10-31')).toBe('Mañana')
  })
})

describe('agruparPorDia', () => {
  it('junta las del mismo día respetando el orden de llegada', () => {
    const grupos = agruparPorDia(
      [
        { id: 'a', fecha: HOY },
        { id: 'b', fecha: HOY },
        { id: 'c', fecha: '2026-10-21' },
        { id: 'd', fecha: '2026-10-23' },
      ],
      HOY,
    )
    expect(grupos.map((grupo) => [grupo.etiqueta, grupo.esHoy, grupo.items.map((item) => item.id)])).toEqual([
      ['Hoy', true, ['a', 'b']],
      ['Mañana', false, ['c']],
      ['Viernes 23 de octubre', false, ['d']],
    ])
  })

  it('sin filas no hay grupos', () => {
    expect(agruparPorDia([], HOY)).toEqual([])
  })
})

describe('textoEspera', () => {
  it.each([
    [0, 'Hoy'],
    [1, 'Ayer'],
    [3, 'Hace 3 días'],
  ])('%i días → %s', (dias, texto) => {
    expect(textoEspera(dias)).toBe(texto)
  })
})

describe('textoFechaHora', () => {
  it('dice el día, la hora y la zona', () => {
    expect(textoFechaHora('2026-10-21', '09:30')).toBe('Miércoles 21 de octubre, 9:30 a. m. (hora de Guatemala)')
  })
})

describe('audienciaEnHora', () => {
  const ocupadas: AudienciaOcupadaDto[] = [
    { id: 'x', hora: '09:00', codigoProceso: '03-2026', descripcion: null },
    { id: 'y', hora: '11:30', codigoProceso: '07-2026', descripcion: 'Conciliación' },
  ]

  it('encuentra la que ya ocupa esa hora', () => {
    expect(audienciaEnHora(ocupadas, '11:30')?.id).toBe('y')
    expect(audienciaEnHora(ocupadas, '10:00')).toBeUndefined()
  })

  it('la audiencia que se reprograma no choca consigo misma', () => {
    expect(audienciaEnHora(ocupadas, '09:00', 'x')).toBeUndefined()
  })
})

describe('separarAcciones', () => {
  it('registrar resultado va primero aunque haya otras', () => {
    expect(separarAcciones(['CANCELAR', 'REGISTRAR_RESULTADO'])).toEqual({
      principal: 'REGISTRAR_RESULTADO',
      secundarias: ['CANCELAR'],
    })
  })

  it('una programada destaca reprogramar', () => {
    expect(separarAcciones(['REPROGRAMAR', 'CAMBIAR_RESPONSABLE', 'CANCELAR'])).toEqual({
      principal: 'REPROGRAMAR',
      secundarias: ['CAMBIAR_RESPONSABLE', 'CANCELAR'],
    })
  })

  it('sin acción principal todo queda en el menú', () => {
    expect(separarAcciones(['EDITAR_OBSERVACIONES', 'ADJUNTAR_DOCUMENTO'])).toEqual({
      principal: null,
      secundarias: ['EDITAR_OBSERVACIONES', 'ADJUNTAR_DOCUMENTO'],
    })
  })
})

describe('textoEnlazada', () => {
  it('fecha corta y hora de la otra audiencia', () => {
    expect(textoEnlazada({ id: 'a', fecha: '2026-11-04', hora: '09:00' })).toBe('04/11/2026 09:00')
  })
})
