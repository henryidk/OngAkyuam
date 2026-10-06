import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsuariaExpedienteHub } from '@akyuam/shared'
import { ToastProvider } from '../../../../components/ui/Toast'
import { api } from '../../../../lib/api'
import { pedirConfirmacionSalida } from '../../../../lib/guardiaSalida'
import { usuariaFicticia } from '../../../../test/usuariaFicticia'
import { buscarUsuariaPorDpi } from '../../api/trabajoSocial.api'
import type { ContextoFicha } from '../contextoFicha'
import EncabezadoFicha from '../EncabezadoFicha'
import PestanaDatos from './PestanaDatos'

vi.mock('../../../../lib/api', () => ({ api: { patch: vi.fn() } }))
vi.mock('../useDetalleCaso', () => ({ useDetalleCaso: () => ({ detalle: null }) }))
vi.mock('../../api/trabajoSocial.api', () => ({ buscarUsuariaPorDpi: vi.fn() }))

const patch = vi.mocked(api.patch)
const buscarPorDpi = vi.mocked(buscarUsuariaPorDpi)

const CASO = {
  id: 'caso-ficticio-1',
  numero: '1-2026',
  fecha: '2026-01-10',
  tipoRegistro: 'INTERNA',
  areasReferidas: ['PSICOLOGIA'],
  estado: 'EN_ATENCION',
  enAlbergue: true,
} as unknown as UsuariaExpedienteHub['casos'][number]

/** La ficha real en pequeño: encabezado con pestañas + la pestaña por ruta anidada. */
function Ficha() {
  const [usuaria, setUsuaria] = useState(usuariaFicticia({ casos: [CASO] }))
  const [editandoDatos, setEditandoDatos] = useState(false)
  const contexto: ContextoFicha = {
    usuaria,
    onUsuariaActualizada: setUsuaria,
    abrirReferir: () => {},
    version: 0,
    setEditandoDatos,
    pedirConfirmacionSalida,
  }
  return (
    <>
      <EncabezadoFicha usuaria={usuaria} editandoDatos={editandoDatos} onReferir={() => {}} onRegistrarEgreso={() => {}} />
      <Outlet context={contexto} />
    </>
  )
}

function montar() {
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/usuarias/u/datos']}>
        <Routes>
          <Route path="/usuarias/u" element={<Ficha />}>
            <Route index element={<p>Contenido del resumen</p>} />
            <Route path="datos" element={<PestanaDatos />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
  return userEvent.setup()
}

async function editarTelefono(user: ReturnType<typeof userEvent.setup>, valor: string) {
  await user.click(screen.getByRole('button', { name: 'Editar' }))
  const telefono = screen.getByLabelText(/Teléfono/)
  await user.clear(telefono)
  await user.type(telefono, valor)
  return telefono
}

describe('PestanaDatos', () => {
  beforeEach(() => {
    patch.mockReset()
    buscarPorDpi.mockReset()
  })

  it('lee los datos con raya en los vacíos y sin casilla de "fuera de Alta Verapaz"', () => {
    montar()

    expect(screen.getByText('Alta Verapaz')).toBeInTheDocument()
    expect(screen.getByText('Dirección').nextElementSibling).toHaveTextContent('—')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('al editar enfoca el primer campo y no deja guardar sin cambios', async () => {
    const user = montar()

    await user.click(screen.getByRole('button', { name: 'Editar' }))

    expect(screen.getByRole('heading', { name: 'Editando datos de la usuaria' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nombres')).toHaveFocus()
    expect(screen.getByText('Sin cambios todavía')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText(/se refleja en/)).toHaveTextContent('Jurídica y Psicológica')
  })

  it('bloquea egreso y referir mientras se edita', async () => {
    const user = montar()

    await user.click(screen.getByRole('button', { name: 'Editar' }))

    for (const nombre of ['Registrar egreso', 'Referir a un área']) {
      const boton = screen.getByRole('button', { name: nombre })
      expect(boton).toBeDisabled()
      expect(boton).toHaveAttribute('title', 'Termina de editar los datos primero')
    }
  })

  it('marca el campo modificado y cuenta los cambios', async () => {
    const user = montar()

    await editarTelefono(user, '11111111')

    expect(screen.getByText('Modificado')).toBeInTheDocument()
    expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })

  it('cambiar de pestaña con cambios pide confirmación; "Seguir editando" se queda', async () => {
    const user = montar()
    await editarTelefono(user, '11111111')

    await user.click(screen.getByRole('link', { name: 'Resumen' }))

    const dialogo = screen.getByRole('dialog', { name: '¿Descartar los cambios?' })
    expect(dialogo).toHaveTextContent('Tienes 1 cambio sin guardar')
    await user.click(within(dialogo).getByRole('button', { name: 'Seguir editando' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Teléfono/)).toHaveValue('11111111')
  })

  it('"Descartar" al cambiar de pestaña navega y no guarda nada', async () => {
    const user = montar()
    await editarTelefono(user, '11111111')

    await user.click(screen.getByRole('link', { name: 'Resumen' }))
    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(screen.getByText('Contenido del resumen')).toBeInTheDocument()
    expect(patch).not.toHaveBeenCalled()
  })

  it('Esc con cambios pide confirmación y "Descartar" restaura la lectura original', async () => {
    const user = montar()
    await editarTelefono(user, '11111111')

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Descartar' }))

    expect(screen.getByRole('heading', { name: 'Datos de la usuaria' })).toBeInTheDocument()
    expect(screen.getByText('00000000')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toHaveFocus()
  })

  it('Esc sin cambios sale directo', async () => {
    const user = montar()
    await user.click(screen.getByRole('button', { name: 'Editar' }))

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Datos de la usuaria' })).toBeInTheDocument()
  })

  it('guarda sin confirmación extra si el DPI no cambió', async () => {
    patch.mockResolvedValue({ data: usuariaFicticia({ casos: [CASO], telefono: '11111111' }) })
    const user = montar()
    await editarTelefono(user, '11111111')

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Datos de la usuaria' })).toBeInTheDocument())
    expect(screen.getByText('11111111')).toBeInTheDocument()
    expect(screen.getByText('Datos actualizados · ya se ven en las áreas y en el reporte')).toBeInTheDocument()
    expect(buscarPorDpi).not.toHaveBeenCalled()
  })

  it('el DPI solo acepta dígitos, avisa si está incompleto y pide confirmación al guardar', async () => {
    buscarPorDpi.mockResolvedValue([])
    patch.mockResolvedValue({ data: usuariaFicticia({ casos: [CASO], dpi: '2000000000002' }) })
    const user = montar()
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dpi = screen.getByLabelText('DPI')

    await user.clear(dpi)
    await user.type(dpi, '20a0-0')
    expect(dpi).toHaveValue('2000')
    expect(dpi).toHaveAccessibleDescription('Debe tener 13 dígitos (lleva 4).')
    expect(dpi).toBeInvalid()
    await waitFor(() => expect(screen.getByText('Revisa los campos marcados en rojo.')).toBeInTheDocument())

    await user.type(dpi, '000000002')
    expect(dpi).toHaveAccessibleDescription('DPI nuevo · se pedirá confirmación al guardar.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const dialogo = screen.getByRole('dialog', { name: '¿Cambiar el DPI?' })
    expect(patch).not.toHaveBeenCalled()
    expect(within(dialogo).getByText('1000000000001')).toHaveClass('line-through')
    expect(await within(dialogo).findByText('No existe otra usuaria con este DPI.')).toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Sí, cambiar DPI' }))
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
  })

  it('no deja confirmar si el DPI nuevo es de otra usuaria', async () => {
    buscarPorDpi.mockResolvedValue([
      {
        id: 'otra-usuaria-ficticia',
        nombres: 'Otra',
        apellidos: 'De Prueba',
        dpi: '2000000000002',
        fechaNacimiento: '1985-01-01',
        numeroExpediente: '2-2026',
      },
    ])
    const user = montar()
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const dpi = screen.getByLabelText('DPI')
    await user.clear(dpi)
    await user.type(dpi, '2000000000002')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    const dialogo = screen.getByRole('dialog', { name: '¿Cambiar el DPI?' })
    expect(await within(dialogo).findByText(/ya pertenece a otra usuaria/)).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: 'Sí, cambiar DPI' })).toBeDisabled()
    expect(within(dialogo).getByRole('link')).toHaveAttribute('href', '/trabajo-social/usuarias/otra-usuaria-ficticia')
  })

  it('el modal atrapa el foco y Esc lo cierra sin salir de la edición', async () => {
    const user = montar()
    await editarTelefono(user, '11111111')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    const dialogo = screen.getByRole('dialog', { name: '¿Descartar los cambios?' })

    await user.tab()
    await user.tab()
    await user.tab()
    expect(dialogo).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Editando datos de la usuaria' })).toBeInTheDocument()
  })

  it('elegir otro departamento muestra sus municipios y "Otro" para escribirlo a mano', async () => {
    const user = montar()
    await user.click(screen.getByRole('button', { name: 'Editar' }))

    await user.selectOptions(screen.getByLabelText('Departamento'), 'Izabal')

    const municipio = screen.getByLabelText('Municipio')
    expect(within(municipio).getByRole('option', { name: 'Livingston' })).toBeInTheDocument()
    expect(municipio).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()

    await user.selectOptions(municipio, 'Otro (no está en la lista)')
    await user.type(screen.getByLabelText('Nombre del municipio'), 'Municipio de prueba')
    await waitFor(() => expect(screen.getByText('2 cambios sin guardar')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
  })
})
