import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CampoLectura from './CampoLectura'

describe('CampoLectura', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['texto vacío', ''],
    ['solo espacios', '  '],
  ])('muestra una raya gris si el valor es %s', (_caso, valor) => {
    render(<CampoLectura etiqueta="Dirección" valor={valor} />)

    const raya = screen.getByText('—')
    expect(raya).toHaveClass('text-gray-400')
  })

  it('muestra el valor, con cifras alineadas si es numérico', () => {
    render(<CampoLectura etiqueta="Teléfono" valor="00000000" formato="numerico" />)

    expect(screen.getByText('00000000')).toHaveClass('tabular-nums')
  })
})
