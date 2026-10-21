import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { hoyGT } from '@akyuam/shared'
import Agenda from './Agenda'
import { listarCitasAgenda } from '../api/psicologia.api'

vi.mock('../../../components/TituloPagina', () => ({ useTituloPagina: () => {} }))
vi.mock('../../../components/ui/Toast', () => ({ useToast: () => ({ mostrar: vi.fn() }) }))
vi.mock('../compartido/contexto', () => ({ useContextoPsicologia: () => ({ resumen: { citasSinRegistrar: 0 }, recargarResumen: vi.fn() }) }))
vi.mock('../api/psicologia.api', () => ({
  listarCitasAgenda: vi.fn().mockResolvedValue([]), listarHuecos: vi.fn().mockResolvedValue([]),
  listarPorAgendar: vi.fn().mockResolvedValue([]), listarProcesosParaAgendar: vi.fn().mockResolvedValue([]),
  marcarNoAsistio: vi.fn(),
}))

describe('agenda compartida', () => {
  it('abre Solo mis pacientes activado y permite consultar citas de otra profesional', async () => {
    vi.mocked(listarCitasAgenda).mockImplementation(async query => query.soloMios === false ? [{
      id: 'cita-colega', procesoId: 'proceso', procesoCodigo: 'P1-01-2026', usuariaId: 'usuaria',
      usuariaNombreCompleto: 'Paciente agenda compartida', persona: { ninoId: null, nombreCompleto: 'Paciente agenda compartida', edad: 35 },
      fechaHora: new Date(`${hoyGT()}T09:00:00-06:00`).toISOString(), duracionMinutos: 45,
      tipo: 'SEGUIMIENTO', estado: 'PROGRAMADA', sinRegistrar: false, borrador: false,
      profesional: { id: 'colega', nombre: 'Psicóloga colega' }, responsable: { id: 'colega', nombre: 'Psicóloga colega' }, propia: false,
    }] : [])
    render(<MemoryRouter><Agenda /></MemoryRouter>)
    const filtro = screen.getByRole('checkbox', { name: 'Solo mis pacientes' })
    expect(filtro).toBeChecked()
    await waitFor(() => expect(listarCitasAgenda).toHaveBeenCalledWith(expect.objectContaining({ soloMios: true })))
    fireEvent.click(filtro)
    expect(await screen.findByText('Profesional: Psicóloga colega')).toBeInTheDocument()
    expect(screen.getByText('Paciente agenda compartida')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reprogramar' })).toBeNull()
    expect(listarCitasAgenda).toHaveBeenCalledWith(expect.objectContaining({ soloMios: false }))
  })
})
