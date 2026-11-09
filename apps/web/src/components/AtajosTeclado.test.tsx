import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AtajosTeclado from './AtajosTeclado'

// jsdom no calcula el diseño: sin esto, ningún elemento cuenta como visible.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
})

function Pantalla({ onNuevo, onAnterior }: { onNuevo: () => void; onAnterior: () => void }) {
  return (
    <main>
      <AtajosTeclado />
      <input type="search" aria-label="Buscar" />
      <input type="text" aria-label="Nota" />
      <button type="button" data-atajo="nuevo" onClick={onNuevo}>
        Programar cita
      </button>
      <button type="button" data-atajo="anterior" onClick={onAnterior}>
        Semana anterior
      </button>
      <div role="tablist">
        <button type="button" role="tab">
          Pestaña
        </button>
      </div>
    </main>
  )
}

describe('AtajosTeclado', () => {
  it('N pulsa el botón principal y ← el de la semana anterior', async () => {
    const usuario = userEvent.setup()
    const onNuevo = vi.fn()
    const onAnterior = vi.fn()
    render(<Pantalla onNuevo={onNuevo} onAnterior={onAnterior} />)

    await usuario.keyboard('n')
    await usuario.keyboard('{ArrowLeft}')

    expect(onNuevo).toHaveBeenCalledTimes(1)
    expect(onAnterior).toHaveBeenCalledTimes(1)
  })

  it('no hace nada mientras se escribe en un campo', async () => {
    const usuario = userEvent.setup()
    const onNuevo = vi.fn()
    render(<Pantalla onNuevo={onNuevo} onAnterior={vi.fn()} />)

    await usuario.click(screen.getByRole('textbox', { name: 'Nota' }))
    await usuario.keyboard('n/')

    expect(onNuevo).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Nota' })).toHaveValue('n/')
  })

  it('/ lleva al buscador sin escribir la barra', async () => {
    const usuario = userEvent.setup()
    render(<Pantalla onNuevo={vi.fn()} onAnterior={vi.fn()} />)

    await usuario.keyboard('/')

    const buscador = screen.getByRole('searchbox', { name: 'Buscar' })
    expect(buscador).toHaveFocus()
    expect(buscador).toHaveValue('')
  })

  it('las flechas dentro de unas pestañas no cambian de semana', async () => {
    const usuario = userEvent.setup()
    const onAnterior = vi.fn()
    render(<Pantalla onNuevo={vi.fn()} onAnterior={onAnterior} />)

    screen.getByRole('tab').focus()
    await usuario.keyboard('{ArrowLeft}')

    expect(onAnterior).not.toHaveBeenCalled()
  })

  it('? abre la lista de atajos y, con ella abierta, N ya no actúa', async () => {
    const usuario = userEvent.setup()
    const onNuevo = vi.fn()
    render(<Pantalla onNuevo={onNuevo} onAnterior={vi.fn()} />)

    await usuario.keyboard('?')
    expect(screen.getByRole('dialog', { name: 'Atajos de teclado' })).toBeInTheDocument()

    await usuario.keyboard('n')
    expect(onNuevo).not.toHaveBeenCalled()
  })
})
