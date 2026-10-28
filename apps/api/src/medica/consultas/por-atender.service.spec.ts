/* eslint-disable @typescript-eslint/unbound-method */
import type { CitaAgendaMedicaDto } from '@akyuam/shared';
import type { ILectorCitasMedicas } from '../interfaces/agenda-medica-repository.interface';
import { PorAtenderService } from './por-atender.service';

// Miércoles 14/10/2026, 09:00 en Guatemala (UTC-6).
const AHORA = new Date('2026-10-14T15:00:00.000Z');

function cita(
  id: string,
  estadoVista: CitaAgendaMedicaDto['estadoVista'],
): CitaAgendaMedicaDto {
  return {
    id,
    estadoVista,
    inicio: '2026-10-14T16:00:00.000Z',
  } as CitaAgendaMedicaDto;
}

describe('PorAtenderService', () => {
  let lector: jest.Mocked<ILectorCitasMedicas>;
  let service: PorAtenderService;

  beforeEach(() => {
    lector = {
      citasEntre: jest
        .fn()
        .mockResolvedValue([
          cita('atendida', 'ATENDIDA'),
          cita('pendiente', 'PROGRAMADA'),
          cita('no-asistio', 'NO_ASISTIO'),
        ]),
      citasSinRegistrar: jest
        .fn()
        .mockResolvedValue([cita('ayer', 'SIN_REGISTRAR')]),
      resumenEntre: jest.fn(),
    };
    service = new PorAtenderService(lector, { ahora: () => AHORA });
  });

  it('separa las de hoy de las atrasadas y deja fuera lo que ya no pide nada', async () => {
    const resultado = await service.listar();
    expect(resultado.hoy.map((c) => c.id)).toEqual(['pendiente']);
    expect(resultado.atrasadas.map((c) => c.id)).toEqual(['ayer']);
  });

  it('el día "hoy" es el de Guatemala y las atrasadas excluyen ese mismo día', async () => {
    await service.listar();
    const desde = new Date('2026-10-14T06:00:00.000Z');
    const hasta = new Date('2026-10-15T06:00:00.000Z');
    expect(lector.citasEntre).toHaveBeenCalledWith(desde, hasta, AHORA);
    expect(lector.citasSinRegistrar).toHaveBeenCalledWith(AHORA, desde, hasta);
  });
});
