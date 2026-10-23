import { describe, expect, it } from 'vitest'
import type { EntradaBitacoraDto } from '@akyuam/shared'
import { agruparBitacora, bloqueFecha, hora12DeInstante, textoCuando, textoDiaRelativo, tituloDia } from './formatoBitacora'

// Datos ficticios. 2026-10-23 es viernes; Guatemala va 6 horas detrás de UTC.
const HOY = '2026-10-23'

function entrada(id: string, createdAt: string, esSistema = false): EntradaBitacoraDto {
  return { id, tipo: 'Memorial', esSistema, contenido: 'Texto', registradoPor: 'Abogada Ficticia', createdAt, documentos: [] }
}

describe('agruparBitacora', () => {
  it('agrupa por día de Guatemala y separa los cambios del sistema', () => {
    const dias = agruparBitacora(
      [
        entrada('a', '2026-10-23T16:00:00.000Z'),
        entrada('b', '2026-10-23T15:00:00.000Z', true),
        // 21:00 del 22 en Guatemala, aunque en UTC ya sea el 23.
        entrada('c', '2026-10-23T03:00:00.000Z'),
        entrada('d', '2026-10-20T15:00:00.000Z', true),
      ],
      HOY,
    )
    expect(dias.map((dia) => dia.fecha)).toEqual(['2026-10-23', '2026-10-22', '2026-10-20'])
    expect(dias[0].actuaciones.map((e) => e.id)).toEqual(['a'])
    expect(dias[0].sistema.map((e) => e.id)).toEqual(['b'])
    expect(dias[1].actuaciones.map((e) => e.id)).toEqual(['c'])
    expect(dias[2].actuaciones).toEqual([])
    expect(dias[2].sistema.map((e) => e.id)).toEqual(['d'])
  })
})

describe('textos de fecha', () => {
  it('títulos de día con Hoy y Ayer', () => {
    expect(tituloDia(HOY, HOY)).toBe('Hoy · Viernes 23 de octubre')
    expect(tituloDia('2026-10-22', HOY)).toBe('Ayer · Jueves 22 de octubre')
    expect(tituloDia('2026-10-20', HOY)).toBe('Martes 20 de octubre')
  })

  it('día relativo de un instante, en hora de Guatemala', () => {
    expect(textoDiaRelativo('2026-10-23T16:00:00.000Z', HOY)).toBe('hoy')
    expect(textoDiaRelativo('2026-10-23T03:00:00.000Z', HOY)).toBe('ayer')
    expect(textoDiaRelativo('2026-10-20T15:00:00.000Z', HOY)).toBe('el 20/10/2026')
  })

  it('cuándo es la audiencia respecto de hoy', () => {
    expect(textoCuando(HOY, HOY)).toBe('hoy')
    expect(textoCuando('2026-10-24', HOY)).toBe('mañana')
    expect(textoCuando('2026-10-28', HOY)).toBe('en 5 días')
    expect(textoCuando('2026-10-22', HOY)).toBe('ayer')
    expect(textoCuando('2026-10-20', HOY)).toBe('hace 3 días')
  })

  it('bloque de calendario y hora en 12 horas', () => {
    expect(bloqueFecha('2026-10-28')).toEqual({ mes: 'OCT', dia: '28', diaSemana: 'mié' })
    expect(bloqueFecha('2026-01-04')).toEqual({ mes: 'ENE', dia: '4', diaSemana: 'dom' })
    expect(hora12DeInstante('2026-10-23T15:30:00.000Z')).toBe('9:30 a. m.')
  })
})
