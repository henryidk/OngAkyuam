import { describe, expect, it } from 'vitest'
import type { ProcesoResumen } from '@akyuam/shared'
import { admiteAudiencias, casoDesdeProceso } from './caso'

// Datos ficticios.
const proceso = {
  id: 'p1',
  codigo: 'ALI-2026-0001',
  usuaria: { id: 'u1', nombreCompleto: 'Usuaria Ficticia' },
  numeroJudicial: null,
  abogada: { id: 'ab1', nombre: 'Lcda. Ficticia' },
  estadoVisible: 'EN_TRAMITE',
} as unknown as ProcesoResumen

describe('casoDesdeProceso', () => {
  it('preselecciona la abogada del proceso', () => {
    expect(casoDesdeProceso(proceso)).toEqual({
      procesoId: 'p1',
      codigoProceso: 'ALI-2026-0001',
      usuariaNombre: 'Usuaria Ficticia',
      numeroJudicial: null,
      responsableId: 'ab1',
    })
  })

  it('sin abogada no preselecciona a nadie', () => {
    expect(casoDesdeProceso({ ...proceso, abogada: null }).responsableId).toBeNull()
  })
})

describe('admiteAudiencias', () => {
  it('solo mientras el proceso sigue abierto', () => {
    expect(admiteAudiencias({ estadoVisible: 'EN_TRAMITE' })).toBe(true)
    expect(admiteAudiencias({ estadoVisible: 'SUSPENDIDO' })).toBe(true)
    expect(admiteAudiencias({ estadoVisible: 'FINALIZADO' })).toBe(false)
    expect(admiteAudiencias({ estadoVisible: 'ABANDONADO' })).toBe(false)
  })
})
