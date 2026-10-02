import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../../lib/api'
import { usuariaFicticia } from '../../../test/usuariaFicticia'
import { useFormularioIdentidad } from './useFormularioIdentidad'

vi.mock('../../../lib/api', () => ({ api: { patch: vi.fn() } }))
const patch = vi.mocked(api.patch)

function montar(onGuardado = vi.fn()) {
  const usuaria = usuariaFicticia()
  return { onGuardado, ...renderHook(() => useFormularioIdentidad(usuaria, onGuardado)) }
}

describe('useFormularioIdentidad', () => {
  beforeEach(() => {
    patch.mockReset()
  })

  it('empieza sin cambios', () => {
    const { result } = montar()

    expect(result.current.camposModificados).toEqual([])
    expect(result.current.dpiModificado).toBe(false)
  })

  it('cuenta los campos modificados y deja de contarlos si vuelven a su valor', () => {
    const { result } = montar()

    act(() => result.current.form.setValue('telefono', '11111111', { shouldDirty: true }))
    expect(result.current.camposModificados).toEqual(['telefono'])
    expect(result.current.dpiModificado).toBe(false)

    act(() => result.current.form.setValue('telefono', '00000000', { shouldDirty: true }))
    expect(result.current.camposModificados).toEqual([])
  })

  it('solo marca el DPI como modificado cuando cambia el DPI', () => {
    const { result } = montar()

    act(() => result.current.form.setValue('dpi', '2000000000002', { shouldDirty: true }))

    expect(result.current.dpiModificado).toBe(true)
  })

  it('no es válido con un DPI incompleto', async () => {
    const { result } = montar()

    await act(async () => {
      result.current.form.setValue('dpi', '123', { shouldDirty: true, shouldValidate: true })
    })

    await waitFor(() => expect(result.current.esValido).toBe(false))
  })

  it('envía el mismo cuerpo que el schema y entrega la usuaria guardada', async () => {
    const guardada = usuariaFicticia({ telefono: '11111111' })
    patch.mockResolvedValue({ data: guardada })
    const { result, onGuardado } = montar()
    act(() => result.current.form.setValue('telefono', '11111111', { shouldDirty: true }))

    await act(() => result.current.guardar())

    expect(patch).toHaveBeenCalledWith('/trabajo-social/usuarias/usuaria-ficticia-1', {
      nombres: 'Persona',
      apellidos: 'De Prueba',
      dpi: '1000000000001',
      telefono: '11111111',
      direccion: '',
      fechaNacimiento: '1990-05-10',
      grupoEtnico: 'LADINO',
      fueraDeAltaVerapaz: false,
      municipio: 'COBAN',
      departamentoOtro: '',
      municipioOtro: '',
      ubicacionGeografica: 'Zona de prueba',
    })
    expect(onGuardado).toHaveBeenCalledWith(guardada)
  })

  it('un 409 deja el mensaje en el campo DPI y conserva lo escrito', async () => {
    patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'El DPI ya está registrado para otra usuaria' } },
    })
    const { result, onGuardado } = montar()
    act(() => result.current.form.setValue('dpi', '2000000000002', { shouldDirty: true }))

    await act(() => result.current.guardar())

    expect(result.current.form.formState.errors.dpi?.message).toBe('El DPI ya está registrado para otra usuaria')
    expect(result.current.form.getValues('dpi')).toBe('2000000000002')
    expect(result.current.errorEnvio).toBeNull()
    expect(onGuardado).not.toHaveBeenCalled()
  })

  it('un error de red queda como error de envío, sin perder lo escrito', async () => {
    patch.mockRejectedValue(new Error('Network Error'))
    const { result } = montar()
    act(() => result.current.form.setValue('telefono', '11111111', { shouldDirty: true }))

    await act(() => result.current.guardar())

    expect(result.current.errorEnvio).not.toBeNull()
    expect(result.current.form.getValues('telefono')).toBe('11111111')
  })
})
