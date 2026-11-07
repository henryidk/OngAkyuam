import {
  hoyGT,
  sumarDiasGT,
  sumarMesesGT,
  type CitaAgendaMedicaDto,
  type ReferenciaBandejaMedicaDto,
  type SinProximaConsultaDto,
} from '@akyuam/shared';
import type { PorAtenderService } from '../consultas/por-atender.service';
import type { ILectorPendientesMedica } from '../interfaces/agenda-medica-repository.interface';
import { BandejaMedicaService } from './bandeja-medica.service';

const CITA = {} as CitaAgendaMedicaDto;

function sinProximaDesde(desde: string): SinProximaConsultaDto {
  return { desde } as SinProximaConsultaDto;
}

describe('BandejaMedicaService.contadores', () => {
  it('la insignia de Consultas suma las de hoy por atender y las atrasadas; la de Agenda, solo las sin próxima consulta de menos de 2 meses', async () => {
    const lector = {
      referenciasPendientes: jest
        .fn()
        .mockResolvedValue([{} as ReferenciaBandejaMedicaDto]),
      sinProxima: jest
        .fn()
        .mockResolvedValue([
          sinProximaDesde(hoyGT()),
          sinProximaDesde(sumarDiasGT(sumarMesesGT(hoyGT(), -2), 1)),
          sinProximaDesde(sumarMesesGT(hoyGT(), -2)),
          sinProximaDesde('2025-01-15'),
        ]),
    } as unknown as ILectorPendientesMedica;
    const porAtender = {
      listar: jest
        .fn()
        .mockResolvedValue({ hoy: [CITA, CITA], atrasadas: [CITA] }),
    } as unknown as PorAtenderService;
    const service = new BandejaMedicaService(lector, porAtender);
    await expect(service.contadores()).resolves.toEqual({
      areaAtencion: 1,
      consultasPorAtender: 3,
      agendaSinProxima: 2,
    });
  });
});
