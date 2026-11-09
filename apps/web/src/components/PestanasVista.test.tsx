import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PestanasVista from './PestanasVista'

function Consultas({ porRegistrar }: { porRegistrar: number }) {
  const [vista, setVista] = useState<'por-registrar' | 'historial'>('por-registrar')
  return (
    <PestanasVista
      etiqueta="Secciones de consultas"
      pestanas={[
        { vista: 'por-registrar', etiqueta: 'Por registrar', conteo: porRegistrar },
        { vista: 'historial', etiqueta: 'Historial' },
      ]}
      activa={vista}
      onCambiar={setVista}
    >
      <p>{vista === 'historial' ? 'Lista del historial' : 'Lista por registrar'}</p>
    </PestanasVista>
  )
}

describe('PestanasVista', () => {
  it('el lector oye el contador separado del nombre de la pestaña', () => {
    render(<Consultas porRegistrar={3} />)

    expect(screen.getByRole('tab', { name: 'Por registrar, 3 pendientes' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: /Por registrar/ })).toHaveTextContent('Lista por registrar')
  })

  it('sin pendientes no muestra ningún número', () => {
    render(<Consultas porRegistrar={0} />)

    expect(screen.getByRole('tab', { name: 'Por registrar' })).toBeInTheDocument()
  })

  it('las flechas cambian de pestaña y solo la activa recibe el tabulador', async () => {
    const usuario = userEvent.setup()
    render(<Consultas porRegistrar={1} />)

    await usuario.tab()
    expect(screen.getByRole('tab', { name: 'Por registrar, 1 pendiente' })).toHaveFocus()

    await usuario.keyboard('{ArrowRight}')
    const historial = screen.getByRole('tab', { name: 'Historial' })
    expect(historial).toHaveFocus()
    expect(historial).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Lista del historial')

    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /Por registrar/ })).toHaveFocus()
  })
})
