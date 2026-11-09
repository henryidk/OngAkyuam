/* eslint-disable @typescript-eslint/unbound-method */
import type { CitaAgendaMedicaDto } from '@akyuam/shared';
import type { ILectorCitasMedicas } from '../interfaces/agenda-medica-repository.interface';
import { PorRegistrarService } from './por-registrar.service';

// Miércoles 14/10/2026, 09:00 en Guatemala (UTC-6).
const AHORA = new Date('2026-10-14T15:00:00.000Z');

function cita(
  id: string,
  estadoVista: CitaAgendaMedicaDto['estadoVista'],
  inicio = '2026-10-14T16:00:00.000Z',
): CitaAgendaMedicaDto {
  const estado = ['EN_CURSO', 'SIN_REGISTRAR'].includes(estadoVista)
    ? 'PROGRAMADA'
    : estadoVista;
  return { id, estado, estadoVista, inicio } as CitaAgendaMedicaDto;
}

describe('PorRegistrarService', () => {
  let lector: jest.Mocked<ILectorCitasMedicas>;
  let service: PorRegistrarService;

  beforeEach(() => {
    lector = {
      citasEntre: jest
        .fn()
        .mockResolvedValue([
          cita('atendida', 'ATENDIDA'),
          cita('mas-tarde', 'PROGRAMADA'),
          cita('en-curso', 'EN_CURSO', '2026-10-14T14:50:00.000Z'),
          cita('no-asistio', 'NO_ASISTIO'),
        ]),
      citasSinRegistrar: jest
        .fn()
        .mockResolvedValue([cita('ayer', 'SIN_REGISTRAR')]),
      contarCitasSinRegistrar: jest.fn().mockResolvedValue(140),
      resumenEntre: jest.fn(),
    };
    service = new PorRegistrarService(lector, { ahora: () => AHORA });
  });

  it('de hoy solo lleva lo que ya empezó: lo que aún no empieza se registra desde la Agenda', async () => {
    const resultado = await service.listar();
    expect(resultado.hoy.map((c) => c.id)).toEqual(['en-curso']);
    expect(resultado.atrasadas.map((c) => c.id)).toEqual(['ayer']);
  });

  it('trae como mucho las 100 atrasadas más recientes, pero el total cuenta todas', async () => {
    const resultado = await service.listar();
    expect(lector.citasSinRegistrar).toHaveBeenCalledWith(
      AHORA,
      expect.any(Date),
      expect.any(Date),
      100,
    );
    expect(resultado.totalAtrasadas).toBe(140);
  });

  it('el día "hoy" es el de Guatemala y las atrasadas excluyen ese mismo día', async () => {
    await service.listar();
    const desde = new Date('2026-10-14T06:00:00.000Z');
    const hasta = new Date('2026-10-15T06:00:00.000Z');
    expect(lector.citasEntre).toHaveBeenCalledWith(desde, hasta, AHORA);
    expect(lector.citasSinRegistrar).toHaveBeenCalledWith(
      AHORA,
      desde,
      hasta,
      100,
    );
    expect(lector.contarCitasSinRegistrar).toHaveBeenCalledWith(
      AHORA,
      desde,
      hasta,
    );
  });
});
