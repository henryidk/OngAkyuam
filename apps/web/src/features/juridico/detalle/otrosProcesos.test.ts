import { describe, expect, it } from 'vitest'
import type { ProcesoResumen } from '@akyuam/shared'
import { agruparOtrosProcesos } from './otrosProcesos'

// Datos ficticios: solo los campos que usa la agrupación.
function proceso(id: string, campos: Partial<ProcesoResumen>): ProcesoResumen {
  return {
    id,
    estadoVisible: 'EN_TRAMITE',
    requiereAtencion: false,
    ultimaActuacionEn: '2026-01-01T00:00:00.000Z',
    fechaCierre: null,
    ...campos,
  } as ProcesoResumen
}

const ids = (procesos: ProcesoResumen[]) => procesos.map((p) => p.id)

describe('agruparOtrosProcesos', () => {
  it('separa en curso (en trámite y suspendidos) de cerrados (finalizados y abandonados)', () => {
    const { abiertos, cerrados } = agruparOtrosProcesos([
      proceso('tramite', {}),
      proceso('finalizado', { estadoVisible: 'FINALIZADO', fechaCierre: '2026-03-01' }),
      proceso('suspendido', { estadoVisible: 'SUSPENDIDO' }),
      proceso('abandonado', { estadoVisible: 'ABANDONADO', fechaCierre: '2026-02-01' }),
    ])
    expect(ids(abiertos).sort()).toEqual(['suspendido', 'tramite'])
    expect(ids(cerrados)).toEqual(['finalizado', 'abandonado'])
  })

  it('pone primero lo que requiere atención y luego lo trabajado más recientemente', () => {
    const { abiertos } = agruparOtrosProcesos([
      proceso('viejo', { ultimaActuacionEn: '2026-01-01T00:00:00.000Z' }),
      proceso('reciente', { ultimaActuacionEn: '2026-05-01T00:00:00.000Z' }),
      proceso('atencion', { requiereAtencion: true, ultimaActuacionEn: '2025-12-01T00:00:00.000Z' }),
    ])
    expect(ids(abiertos)).toEqual(['atencion', 'reciente', 'viejo'])
  })

  it('ordena los cerrados del más reciente al más antiguo', () => {
    const { cerrados } = agruparOtrosProcesos([
      proceso('a', { estadoVisible: 'FINALIZADO', fechaCierre: '2025-06-01' }),
      proceso('b', { estadoVisible: 'ABANDONADO', fechaCierre: '2026-06-01' }),
    ])
    expect(ids(cerrados)).toEqual(['b', 'a'])
  })

  it('no modifica la lista que recibe', () => {
    const original = [proceso('x', { ultimaActuacionEn: '2025-01-01T00:00:00.000Z' }), proceso('y', {})]
    agruparOtrosProcesos(original)
    expect(ids(original)).toEqual(['x', 'y'])
  })
})
