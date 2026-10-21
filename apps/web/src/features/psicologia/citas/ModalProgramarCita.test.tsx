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
