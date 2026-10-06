import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import CampoMunicipioFuera from './CampoMunicipioFuera'

/** Envoltorio con estado propio, como lo usa el formulario a través de `Controller`. */
function Campo({ departamento, inicial = '' }: { departamento: string; inicial?: string }) {
  const [valor, setValor] = useState(inicial)
  return (
    <>
      <CampoMunicipioFuera key={departamento} departamento={departamento} valor={valor} onCambiar={setValor} />
      <output data-testid="valor">{valor}</output>
      <button type="button" onClick={() => setValor(inicial)}>
        Descartar
      </button>
    </>
  )
}

const valorGuardado = () => screen.getByTestId('valor').textContent

describe('CampoMunicipioFuera', () => {
  it('sin departamento está deshabilitado y pide elegirlo primero', () => {
    render(<Campo departamento="" />)

    expect(screen.getByLabelText('Municipio')).toBeDisabled()
    expect(screen.getByText('Elige primero el departamento.')).toBeInTheDocument()
  })

  it('lista solo los municipios del departamento, en orden alfabético y con "Otro" al final', () => {
    render(<Campo departamento="Izabal" />)

    const opciones = screen.getAllByRole('option').map((opcion) => opcion.textContent)
    expect(opciones).toEqual([
      'Selecciona un municipio',
      'El Estor',
      'Livingston',
      'Los Amates',
      'Morales',
      'Puerto Barrios',
      'Otro (no está en la lista)',
    ])
  })

  it('elegir de la lista guarda el nombre exacto del catálogo', async () => {
    const usuario = userEvent.setup()
    render(<Campo departamento="Izabal" />)

    await usuario.selectOptions(screen.getByLabelText('Municipio'), 'Livingston')

    expect(valorGuardado()).toBe('Livingston')
  })

  it('"Otro" abre un campo de texto y guarda lo escrito, sin espacios de más', async () => {
    const usuario = userEvent.setup()
    render(<Campo departamento="Izabal" />)

    await usuario.selectOptions(screen.getByLabelText('Municipio'), 'Otro (no está en la lista)')
    const texto = screen.getByLabelText('Nombre del municipio')
    expect(texto).toHaveFocus()
    await usuario.type(texto, '  Municipio   Nuevo ')
    await usuario.tab()

    expect(valorGuardado()).toBe('Municipio Nuevo')
  })

  it('si lo escrito a mano ya está en la lista, ofrece usar el del catálogo', async () => {
    const usuario = userEvent.setup()
    render(<Campo departamento="Izabal" />)

    await usuario.selectOptions(screen.getByLabelText('Municipio'), 'Otro (no está en la lista)')
    await usuario.type(screen.getByLabelText('Nombre del municipio'), 'puerto barrios')
    await usuario.click(screen.getByRole('button', { name: 'Usar Puerto Barrios' }))

    expect(valorGuardado()).toBe('Puerto Barrios')
    expect(screen.queryByLabelText('Nombre del municipio')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Municipio')).toHaveValue('Puerto Barrios')
  })

  it('un valor guardado que no está en la lista se abre como escrito a mano', () => {
    render(<Campo departamento="Izabal" inicial="Aldea Ficticia" />)

    expect(screen.getByLabelText('Municipio')).toHaveValue('__otro__')
    expect(screen.getByLabelText('Nombre del municipio')).toHaveValue('Aldea Ficticia')
  })

  it('al descartar cambios vuelve al municipio guardado de la lista', async () => {
    const usuario = userEvent.setup()
    render(<Campo departamento="Izabal" inicial="Morales" />)

    await usuario.selectOptions(screen.getByLabelText('Municipio'), 'Otro (no está en la lista)')
    await usuario.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(screen.queryByLabelText('Nombre del municipio')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Municipio')).toHaveValue('Morales')
  })
})
