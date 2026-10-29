import { describe, expect, it } from 'vitest'
import type { AudienciaDetalleDto, EstadoAudiencia } from '@akyuam/shared'
import { agruparReprogramaciones } from './reprogramaciones'

// Datos ficticios. Solo importan id, inicio, estado y los enlaces.
function audiencia(
  id: string,
  inicio: string,
  estado: EstadoAudiencia,
  enlaces: { desde?: string; a?: string } = {},
): AudienciaDetalleDto {
  const enlazada = (otra?: string) => (otra ? { id: otra, fecha: '2026-01-01', hora: '00:00' } : null)
  return {
    id,
    inicio,
    estado,
    reprogramadaDesde: enlazada(enlaces.desde),
    reprogramadaA: enlazada(enlaces.a),
  } as AudienciaDetalleDto
}

const ids = (grupos: ReturnType<typeof agruparReprogramaciones>) =>
  grupos.map((grupo) => [grupo.audiencia.id, ...grupo.anteriores.map((anterior) => `${anterior.audiencia.id}:${anterior.sentido}`)])

describe('agruparReprogramaciones', () => {
  it('una audiencia adelantada queda en una sola tarjeta con la fecha vigente al frente', () => {
    // Orden del backend: por fecha descendente, así que la original (más lejana) llega primero.
    const grupos = agruparReprogramaciones([
      audiencia('original', '2026-11-02T16:00:00Z', 'REPROGRAMADA', { a: 'nueva' }),
      audiencia('nueva', '2026-10-28T20:00:00Z', 'PROGRAMADA', { desde: 'original' }),
    ])
    expect(ids(grupos)).toEqual([['nueva', 'original:ADELANTO']])
  })

  it('una cadena de varias reprogramaciones va de la más reciente a la más antigua', () => {
    const grupos = agruparReprogramaciones([
      audiencia('c', '2026-11-10T16:00:00Z', 'PROGRAMADA', { desde: 'b' }),
      audiencia('a', '2026-11-05T16:00:00Z', 'REPROGRAMADA', { a: 'b' }),
      audiencia('b', '2026-11-01T16:00:00Z', 'REPROGRAMADA', { desde: 'a', a: 'c' }),
    ])
    expect(ids(grupos)).toEqual([['c', 'b:POSPUSO', 'a:ADELANTO']])
  })

  it('la nueva fecha de una audiencia no realizada sigue siendo otra tarjeta', () => {
    const grupos = agruparReprogramaciones([
      audiencia('nueva', '2026-11-10T16:00:00Z', 'PROGRAMADA', { desde: 'fallida' }),
      audiencia('fallida', '2026-10-20T16:00:00Z', 'NO_REALIZADA', { a: 'nueva' }),
    ])
    expect(ids(grupos)).toEqual([['nueva'], ['fallida']])
  })

  it('sin reprogramaciones conserva el orden recibido', () => {
    const grupos = agruparReprogramaciones([
      audiencia('x', '2026-11-10T16:00:00Z', 'PROGRAMADA'),
      audiencia('y', '2026-10-01T16:00:00Z', 'REALIZADA'),
    ])
    expect(ids(grupos)).toEqual([['x'], ['y']])
  })
})
