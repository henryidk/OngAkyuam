import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registrarGuardiaSalida } from '../lib/guardiaSalida'
import { useAuthStore } from '../store/auth.store'
import LogoutButton from './LogoutButton'

describe('LogoutButton', () => {
  const logout = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    logout.mockClear()
    useAuthStore.setState({ logout })
  })

  let retirarGuardia: (() => void) | null = null
  afterEach(() => {
    retirarGuardia?.()
    retirarGuardia = null
  })

  it('pide confirmación antes de cerrar la sesión', async () => {
    const usuario = userEvent.setup()
    render(<LogoutButton />)

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(screen.getByRole('dialog', { name: '¿Cerrar sesión?' })).toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('"Seguir aquí" cierra el aviso sin cerrar la sesión', async () => {
    const usuario = userEvent.setup()
    render(<LogoutButton />)

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await usuario.click(screen.getByRole('button', { name: 'Seguir aquí' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(logout).not.toHaveBeenCalled()
  })

  it('cierra la sesión al confirmar', async () => {
    const usuario = userEvent.setup()
    render(<LogoutButton />)

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    const dialogo = screen.getByRole('dialog')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }))

    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('con cambios sin guardar usa esa confirmación y no encadena un segundo aviso', async () => {
    const usuario = userEvent.setup()
    const guardia = vi.fn()
    retirarGuardia = registrarGuardiaSalida(guardia)
    render(<LogoutButton />)

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(guardia).toHaveBeenCalledTimes(1)
    expect(logout).not.toHaveBeenCalled()

    // La pantalla con cambios confirma que se descartan: recién ahí se cierra la sesión.
    guardia.mock.calls[0][0]()
    expect(logout).toHaveBeenCalledTimes(1)
  })
})
