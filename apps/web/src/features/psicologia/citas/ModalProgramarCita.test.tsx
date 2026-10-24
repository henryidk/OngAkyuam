import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ModalProgramarCita from './ModalProgramarCita'

vi.mock('../api/psicologia.api', () => ({ abrirProcesoDesdeFicha: vi.fn(), atenderReferencia: vi.fn(), moverCita: vi.fn(), programarCitaEnProceso: vi.fn() }))
describe('validación del horario al programar cita', () => {
  it('explica que la hora queda fuera del horario laboral, sin pedir datos ya ingresados', async () => {
    render(<ModalProgramarCita destino={{ tipo: 'NUEVO', usuariaId: 'prueba', usuariaNombreCompleto: 'Usuaria prueba', expedienteNumero: '01-2026' }} fechaInicial="2026-10-26" horaInicial="20:10" onCerrar={() => {}} onGuardada={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Programar cita' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('fuera del horario laboral')
    expect(screen.queryByText('Indica la fecha y la hora de la cita.')).toBeNull()
  })
})


describe('persona del proceso al programar una cita', () => {
  const procesos = [
    { procesoId: 'madre', codigo: 'P2-02-2026', usuariaId: 'usuaria', usuariaNombreCompleto: 'Maria Batz', personas: [{ ninoId: null, nombreCompleto: 'Maria Batz', edad: 27 }], proximaCita: null, tieneCitaSinRegistrar: false },
    { procesoId: 'hijo', codigo: 'P5-02-2026.01', usuariaId: 'usuaria', usuariaNombreCompleto: 'Maria Batz', personas: [{ ninoId: 'nino', nombreCompleto: 'Juan Perez', edad: 6 }], proximaCita: null, tieneCitaSinRegistrar: false },
  ]

  it('distingue el proceso del hijo del de su madre en el selector', () => {
    render(<ModalProgramarCita destino={{ tipo: 'PROCESO', procesos, procesoId: null }} fechaInicial="2026-10-26" onCerrar={() => {}} onGuardada={() => {}} />)
    expect(screen.getByRole('option', { name: 'Juan Perez · P5-02-2026.01' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Maria Batz · P2-02-2026' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Maria Batz · P5-02-2026.01' })).toBeNull()
  })

  it.each([false, true])('muestra al hijo con el proceso preseleccionado (sin cita: %s)', (sinCita) => {
    render(<ModalProgramarCita destino={{ tipo: 'PROCESO', procesos, procesoId: 'hijo', sinCita }} fechaInicial="2026-10-26" onCerrar={() => {}} onGuardada={() => {}} />)
    expect(screen.getByText(sinCita ? 'Juan Perez · P5-02-2026.01 · indica cuándo fue la sesión' : 'Juan Perez · P5-02-2026.01')).toBeInTheDocument()
    expect(screen.queryByText(/Maria Batz/)).toBeNull()
  })
})
