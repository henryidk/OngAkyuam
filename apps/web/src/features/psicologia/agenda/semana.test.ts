import { describe, expect, it } from 'vitest'
import type { CitaAgendaDto, ProcesoParaAgendarDto } from '@akyuam/shared'
import {
  citaPrincipal,
  citasSinRegistrarFuera,
  diasVisibles,
  fechaValida,
  lunesDe,
  procesosSinProximaCita,
  resumenDelDia,
} from './semana'

// Datos ficticios. 2026-10-07 es miércoles; las horas están en UTC (Guatemala = UTC-6).
function cita(parcial: Partial<CitaAgendaDto>): CitaAgendaDto {
  return {
    id: 'cita-1',
    procesoId: 'proceso-1',
    procesoCodigo: 'P1-05-2026',
    usuariaId: 'usuaria-1',
    usuariaNombreCompleto: 'Usuaria Ficticia',
    persona: { ninoId: null, nombreCompleto: 'Usuaria Ficticia', edad: 30 },
    fechaHora: '2026-10-07T15:00:00.000Z',
    duracionMinutos: 45,
    tipo: 'SEGUIMIENTO',
    estado: 'PROGRAMADA',
    sinRegistrar: false,
    borrador: false,
    ...parcial,
  }
}

describe('semana de la agenda', () => {
  it('encuentra el lunes de cualquier día, incluido el domingo', () => {
    expect(lunesDe('2026-10-07')).toBe('2026-10-05')
    expect(lunesDe('2026-10-05')).toBe('2026-10-05')
    expect(lunesDe('2026-10-11')).toBe('2026-10-05')
  })

  it('ignora un parámetro de la URL que no sea una fecha', () => {
    expect(fechaValida('2026-10-07')).toBe('2026-10-07')
    expect(fechaValida('mañana')).toBeNull()
    expect(fechaValida(null)).toBeNull()
  })

  it('muestra de lunes a viernes, y el fin de semana solo si tiene citas o está abierto', () => {
    const laborales = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
    expect(diasVisibles('2026-10-05', '2026-10-07', new Set())).toEqual(laborales)
    expect(diasVisibles('2026-10-05', '2026-10-07', new Set(['2026-10-10']))).toEqual([...laborales, '2026-10-10'])
    expect(diasVisibles('2026-10-05', '2026-10-11', new Set())).toEqual([...laborales, '2026-10-11'])
  })
})

describe('cita principal del día', () => {
  const temprano = cita({ id: 'a', fechaHora: '2026-10-07T15:00:00.000Z' })
  const tarde = cita({ id: 'b', fechaHora: '2026-10-07T20:00:00.000Z' })

  it('es la que está en curso', () => {
    expect(citaPrincipal([temprano, tarde], Date.parse('2026-10-07T15:20:00.000Z'))).toBe('a')
  })

  it('si ninguna está en curso, es la siguiente', () => {
    expect(citaPrincipal([temprano, tarde], Date.parse('2026-10-07T16:30:00.000Z'))).toBe('b')
  })

  it('no hay principal cuando todas terminaron o ya se registraron', () => {
    expect(citaPrincipal([temprano, tarde], Date.parse('2026-10-07T23:00:00.000Z'))).toBeNull()
    expect(citaPrincipal([cita({ estado: 'ATENDIDA' })], Date.parse('2026-10-07T15:20:00.000Z'))).toBeNull()
  })
})

describe('resumen del día', () => {
  it('cuenta cada estado y separa las que quedaron sin registrar', () => {
    expect(
      resumenDelDia([
        cita({ id: 'a', sinRegistrar: true }),
        cita({ id: 'b' }),
        cita({ id: 'c' }),
        cita({ id: 'd', estado: 'ATENDIDA' }),
        cita({ id: 'e', estado: 'NO_ASISTIO' }),
      ]),
    ).toBe('5 citas · 2 por atender · 1 atendida · 1 no asistió · 1 sin registrar')
  })

  it('un día vacío lo dice sin ceros', () => {
    expect(resumenDelDia([])).toBe('Sin citas')
  })
})

describe('pendientes de la agenda: cada uno en un solo lugar', () => {
  const HOY = '2026-10-07'
  const deHoy = cita({ id: 'hoy', fechaHora: '2026-10-07T15:00:00.000Z', sinRegistrar: true })
  const deAyer = cita({ id: 'ayer', fechaHora: '2026-10-06T15:00:00.000Z', sinRegistrar: true })

  function proceso(parcial: Partial<ProcesoParaAgendarDto>): ProcesoParaAgendarDto {
    return {
      procesoId: 'proceso-1',
      codigo: 'P1-05-2026',
      usuariaId: 'usuaria-1',
      usuariaNombreCompleto: 'Usuaria Ficticia',
      personas: [],
      proximaCita: null,
      tieneCitaSinRegistrar: false,
      ...parcial,
    }
  }

  it('la cita sin registrar de hoy queda solo en la lista del día, no en el panel', () => {
    expect(citasSinRegistrarFuera(HOY, [deHoy, deAyer]).map((c) => c.id)).toEqual(['ayer'])
  })

  it('la de ayer sale en el panel mientras el día abierto sea otro', () => {
    expect(citasSinRegistrarFuera(HOY, [deAyer]).map((c) => c.id)).toEqual(['ayer'])
    expect(citasSinRegistrarFuera('2026-10-06', [deAyer])).toEqual([])
  })

  it('el panel ignora las citas que ya están resueltas o aún no terminan', () => {
    const pendiente = cita({ id: 'luego', fechaHora: '2026-10-06T15:00:00.000Z', sinRegistrar: false })
    expect(citasSinRegistrarFuera(HOY, [pendiente])).toEqual([])
  })

  it('un proceso con una cita sin registrar no aparece en "Sin próxima cita"', () => {
    const procesos = [
      proceso({ procesoId: 'sin-nada' }),
      proceso({ procesoId: 'atrasado', tieneCitaSinRegistrar: true }),
      proceso({ procesoId: 'con-cita', proximaCita: { id: 'c', fechaHora: '2026-10-09T15:00:00.000Z' } }),
    ]
    expect(procesosSinProximaCita(procesos).map((p) => p.procesoId)).toEqual(['sin-nada'])
  })
})
