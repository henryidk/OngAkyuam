import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Modal, { CuerpoModal } from './Modal'

function abrir(props: Partial<Parameters<typeof Modal>[0]> = {}) {
  const onCerrar = vi.fn()
  const { container } = render(
    <Modal abierto titulo="Programar consulta" onCerrar={onCerrar} {...props}>
      <CuerpoModal>Contenido</CuerpoModal>
    </Modal>,
  )
  const fondo = document.body.querySelector<HTMLElement>('[aria-hidden="true"].absolute')!
  return { onCerrar, fondo, container }
}

describe('Modal', () => {
  it('por defecto se cierra con Esc y con la X, pero no tocando fuera', async () => {
    const usuario = userEvent.setup()
    const { onCerrar, fondo } = abrir()

    await usuario.click(fondo)
    expect(onCerrar).not.toHaveBeenCalled()

    await usuario.keyboard('{Escape}')
    await usuario.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(onCerrar).toHaveBeenCalledTimes(2)
  })

  it('con cerrarAlTocarFuera, tocar fuera lo cierra', async () => {
    const usuario = userEvent.setup()
    const { onCerrar, fondo } = abrir({ cerrarAlTocarFuera: true })

    await usuario.click(fondo)

    expect(onCerrar).toHaveBeenCalledTimes(1)
  })

  it('solo con Cancelar: sin X, y ni Esc ni tocar fuera pierden lo ya elegido', async () => {
    const usuario = userEvent.setup()
    const { onCerrar, fondo } = abrir({ soloConCancelar: true, cerrarAlTocarFuera: true })

    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument()
    await usuario.keyboard('{Escape}')
    await usuario.click(fondo)

    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('mientras guarda no se cierra de ninguna forma', async () => {
    const usuario = userEvent.setup()
    const { onCerrar, fondo } = abrir({ ocupado: true, cerrarAlTocarFuera: true })

    await usuario.keyboard('{Escape}')
    await usuario.click(fondo)
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeDisabled()

    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('la descripción acompaña al título para el lector de pantalla', () => {
    abrir({ descripcion: 'Elige el día y la hora.' })

    expect(screen.getByRole('dialog', { name: 'Programar consulta' })).toHaveAccessibleDescription('Elige el día y la hora.')
  })
})
