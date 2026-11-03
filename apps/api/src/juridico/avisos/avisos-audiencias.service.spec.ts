/* eslint-disable @typescript-eslint/unbound-method */
import { finDiaGT, type AudienciaFilaDto } from '@akyuam/shared';
import type { IReloj } from '../../common/reloj';
import type { IAgendaAudienciasRepository } from '../interfaces/agenda-audiencias-repository.interface';
import { AvisosAudienciasService } from './avisos-audiencias.service';

/** Lunes 02/11/2026 a las 23:30 en Guatemala: en UTC ya es martes 03/11. */
const AHORA = new Date('2026-11-03T05:30:00.000Z');

function audiencia(id: string, fecha: string): AudienciaFilaDto {
  return { id, fecha } as AudienciaFilaDto;
}

describe('AvisosAudienciasService', () => {
  let agendaRepository: jest.Mocked<IAgendaAudienciasRepository>;
  let service: AvisosAudienciasService;

  beforeEach(() => {
    agendaRepository = {
      listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      listarOcupadas: jest.fn(),
      listarPorProceso: jest.fn(),
    };
    const reloj: IReloj = { ahora: () => AHORA };
    service = new AvisosAudienciasService(agendaRepository, reloj);
  });

  it('pide las próximas de todo el área hasta el fin del día hoy + 7, con "hoy" en Guatemala', async () => {
    const avisos = await service.obtener();

    expect(avisos.hoy).toBe('2026-11-02');
    expect(agendaRepository.listar).toHaveBeenCalledWith({
      vista: 'proximas',
      hasta: finDiaGT('2026-11-09'),
      page: 1,
      pageSize: 100,
      ahora: AHORA,
    });
    // Ni `mias` ni responsable: avisa a todo el equipo.
    const params = agendaRepository.listar.mock.calls[0][0];
    expect(params.responsableUsuarioId).toBeUndefined();
    expect(params.responsableId).toBeUndefined();
  });

  it('clasifica cada audiencia y cuenta por nivel', async () => {
    agendaRepository.listar.mockResolvedValue({
      items: [
        audiencia('a', '2026-11-02'),
        audiencia('b', '2026-11-03'),
        audiencia('c', '2026-11-03'),
        audiencia('d', '2026-11-04'),
        audiencia('e', '2026-11-09'),
      ],
      total: 5,
    });

    const avisos = await service.obtener();

    expect(
      avisos.avisos.map((a) => [a.audiencia.id, a.nivel, a.diasRestantes]),
    ).toEqual([
      ['a', 'HOY', 0],
      ['b', 'MANANA', 1],
      ['c', 'MANANA', 1],
      ['d', 'PASADO_MANANA', 2],
      ['e', 'PROXIMOS_DIAS', 7],
    ]);
    expect(avisos.conteos).toEqual({
      HOY: 1,
      MANANA: 2,
      PASADO_MANANA: 1,
      PROXIMOS_DIAS: 1,
    });
    expect(avisos.total).toBe(5);
  });

  it('manda solo lo que muestra la campana: ni número judicial, ni acciones, ni versión', async () => {
    agendaRepository.listar.mockResolvedValue({
      items: [
        {
          ...audiencia('a', '2026-11-03'),
          numeroJudicial: 'Juzgado Ficticio 01-2026',
          accionesDisponibles: ['REPROGRAMAR'],
          version: 3,
        } as unknown as AudienciaFilaDto,
      ],
      total: 1,
    });

    const avisos = await service.obtener();

    expect(Object.keys(avisos.avisos[0].audiencia).sort()).toEqual([
      'descripcion',
      'fecha',
      'hora',
      'id',
      'procesoId',
      'responsable',
      'tipoProceso',
      'usuaria',
    ]);
  });
});
