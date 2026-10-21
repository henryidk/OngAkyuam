import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReferidoCreado } from '@akyuam/shared'
import { referirCaso } from '../../trabajo-social/api/trabajoSocial.api'
import { useReferirAreas } from './useReferirAreas'

vi.mock('../../trabajo-social/api/trabajoSocial.api', () => ({
  referirCaso: vi.fn(),
}))

const referir = vi.mocked(referirCaso)
const EXPEDIENTE = 'exp-1'

describe('useReferirAreas', () => {
  beforeEach(() => {
    referir.mockReset()
    referir.mockResolvedValue({} as ReferidoCreado)
  })

  it('refiere cada área elegida con su motivo y sin documentos (todavía no existen)', async () => {
    const { result } = renderHook(() => useReferirAreas(EXPEDIENTE))

    act(() => result.current.actualizar('JURIDICO', { seleccionada: true, motivo: 'Denuncia' }))
    act(() => result.current.actualizar('PSICOLOGIA', { seleccionada: true, datosCaso: false }))
    expect(result.current.porEnviar).toEqual(['JURIDICO', 'PSICOLOGIA'])

    let ok = false
    await act(async () => {
      ok = await result.current.referirSeleccionadas()
    })

    expect(ok).toBe(true)
    expect(referir).toHaveBeenCalledWith(EXPEDIENTE, {
      area: 'JURIDICO',
      motivo: 'Denuncia',
      visibilidad: { datosCaso: true, documentos: [] },
    })
    expect(referir).toHaveBeenCalledWith(EXPEDIENTE, {
      area: 'PSICOLOGIA',
      motivo: '',
      visibilidad: { datosCaso: false, documentos: [] },
    })
    expect(result.current.referidas).toEqual(['JURIDICO', 'PSICOLOGIA'])
    expect(result.current.porEnviar).toEqual([])
  })

  it('si un área falla, las anteriores quedan referidas y al reintentar no se reenvían', async () => {
    referir.mockResolvedValueOnce({} as ReferidoCreado).mockRejectedValueOnce(new Error('sin conexión'))
    const { result } = renderHook(() => useReferirAreas(EXPEDIENTE))
    act(() => result.current.actualizar('JURIDICO', { seleccionada: true }))
    act(() => result.current.actualizar('MEDICA', { seleccionada: true }))

    let ok = true
    await act(async () => {
      ok = await result.current.referirSeleccionadas()
    })
    expect(ok).toBe(false)
    expect(result.current.error).toContain('Médica')
    expect(result.current.referidas).toEqual(['JURIDICO'])

    await act(async () => {
      ok = await result.current.referirSeleccionadas()
    })
    expect(ok).toBe(true)
    expect(referir).toHaveBeenCalledTimes(3)
    expect(referir.mock.calls[2]?.[1]).toMatchObject({ area: 'MEDICA' })
  })

  it('un área ya referida no se puede desmarcar desde aquí', async () => {
    const { result } = renderHook(() => useReferirAreas(EXPEDIENTE))
    act(() => result.current.actualizar('MEDICA', { seleccionada: true }))
    await act(async () => {
      await result.current.referirSeleccionadas()
    })

    act(() => result.current.actualizar('MEDICA', { seleccionada: false }))
    expect(result.current.referencias.MEDICA).toMatchObject({ seleccionada: true, referida: true })
  })

  it('sin áreas elegidas no envía nada', async () => {
    const { result } = renderHook(() => useReferirAreas(EXPEDIENTE))
    let ok = false
    await act(async () => {
      ok = await result.current.referirSeleccionadas()
    })
    expect(ok).toBe(true)
    expect(referir).not.toHaveBeenCalled()
  })
})
