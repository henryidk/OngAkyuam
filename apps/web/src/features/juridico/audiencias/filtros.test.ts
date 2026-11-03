import { describe, expect, it } from 'vitest'
import { aplicarCambios, leerFiltros, queryDesdeFiltros, textoRangoProximas } from './filtros'

const HOY = '2026-10-20'

describe('leerFiltros', () => {
  it('sin parámetros: Próximas, página 1 y el Historial de los últimos 90 días', () => {
    expect(leerFiltros(new URLSearchParams(), HOY)).toEqual({
      vista: 'proximas',
      responsableId: '',
      mias: false,
      desde: '2026-07-22',
      hasta: HOY,
      estado: '',
      page: 1,
      rangoProximas: null,
    })
  })

  it('ignora valores editados a mano que no existen', () => {
    const filtros = leerFiltros(new URLSearchParams('vista=otra&estado=BORRADA&desde=2026-02-30&page=-4'), HOY)
    expect(filtros).toMatchObject({ vista: 'proximas', estado: '', desde: '2026-07-22', page: 1 })
  })

  it('lee la pestaña, el rango y el estado válidos', () => {
    const filtros = leerFiltros(
      new URLSearchParams('vista=historial&desde=2026-01-01&hasta=2026-03-31&estado=CANCELADA&page=3&mias=true'),
      HOY,
    )
    expect(filtros).toMatchObject({ vista: 'historial', desde: '2026-01-01', hasta: '2026-03-31', estado: 'CANCELADA', page: 3, mias: true })
  })
})

describe('rango de Próximas (al abrir una notificación)', () => {
  it('Próximas acotada a unos días manda ese rango al servidor', () => {
    const filtros = leerFiltros(new URLSearchParams('desde=2026-10-21&hasta=2026-10-21'), HOY)
    expect(filtros.rangoProximas).toEqual({ desde: '2026-10-21', hasta: '2026-10-21' })
    expect(queryDesdeFiltros(filtros, '')).toMatchObject({ vista: 'proximas', desde: '2026-10-21', hasta: '2026-10-21', estado: undefined })
  })

  it('un rango inválido o invertido se ignora y se ven todas las próximas', () => {
    for (const url of ['desde=2026-10-25&hasta=2026-10-21', 'desde=2026-02-30&hasta=2026-10-21', 'desde=2026-10-21']) {
      const filtros = leerFiltros(new URLSearchParams(url), HOY)
      expect(filtros.rangoProximas).toBeNull()
      expect(queryDesdeFiltros(filtros, '')).toMatchObject({ desde: undefined, hasta: undefined })
    }
  })

  it('Pendientes nunca se acota por fechas', () => {
    const filtros = leerFiltros(new URLSearchParams('vista=pendientes&desde=2026-10-21&hasta=2026-10-21'), HOY)
    expect(filtros.rangoProximas).toBeNull()
    expect(queryDesdeFiltros(filtros, '')).toMatchObject({ desde: undefined, hasta: undefined })
  })

  it('quitar el rango borra las fechas de la URL y vuelve a la primera página', () => {
    const url = aplicarCambios(new URLSearchParams('desde=2026-10-21&hasta=2026-10-21&page=2'), { desde: '', hasta: '' })
    expect(url.toString()).toBe('')
  })

  it('describe el rango con palabras', () => {
    expect(textoRangoProximas({ desde: '2026-10-21', hasta: '2026-10-21' }, HOY)).toBe('de mañana (Mié 21 oct)')
    expect(textoRangoProximas({ desde: '2026-10-23', hasta: '2026-10-27' }, HOY)).toBe('del Vie 23 oct al Mar 27 oct')
    expect(textoRangoProximas({ desde: '2026-10-20', hasta: '2026-10-22' }, HOY)).toBe('del Mar 20 oct al Jue 22 oct')
  })
})

describe('queryDesdeFiltros', () => {
  it('fuera del Historial no manda rango ni estado', () => {
    const filtros = leerFiltros(new URLSearchParams('vista=pendientes&estado=REALIZADA'), HOY)
    expect(queryDesdeFiltros(filtros, '')).toEqual({
      vista: 'pendientes',
      q: undefined,
      responsableId: undefined,
      mias: undefined,
      desde: undefined,
      hasta: undefined,
      estado: undefined,
      page: 1,
    })
  })

  it('"Solo mías" tiene prioridad sobre la responsable elegida', () => {
    const filtros = leerFiltros(new URLSearchParams('responsable=abc&mias=true'), HOY)
    expect(queryDesdeFiltros(filtros, 'lop')).toMatchObject({ q: 'lop', responsableId: undefined, mias: true })
  })
})

describe('aplicarCambios', () => {
  it('cambiar un filtro vuelve a la primera página', () => {
    const url = aplicarCambios(new URLSearchParams('page=4'), { responsableId: 'abc' })
    expect(url.toString()).toBe('responsable=abc')
  })

  it('cambiar de pestaña limpia los filtros del Historial y Próximas no se escribe', () => {
    const url = aplicarCambios(new URLSearchParams('vista=historial&desde=2026-01-01&estado=CANCELADA&mias=true'), {
      vista: 'proximas',
    })
    expect(url.toString()).toBe('mias=true')
  })

  it('la página se conserva solo cuando es lo único que cambia', () => {
    expect(aplicarCambios(new URLSearchParams('vista=pendientes'), { page: 2 }).toString()).toBe('vista=pendientes&page=2')
  })
})
