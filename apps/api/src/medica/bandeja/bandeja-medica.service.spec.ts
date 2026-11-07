import type {
  CitaAgendaMedicaDto,
  ReferenciaBandejaMedicaDto,
  SinProximaConsultaDto,
} from '@akyuam/shared';
import type { PorAtenderService } from '../consultas/por-atender.service';
import type { ILectorPendientesMedica } from '../interfaces/agenda-medica-repository.interface';
import { BandejaMedicaService } from './bandeja-medica.service';

const CITA = {} as CitaAgendaMedicaDto;

describe('BandejaMedicaService.contadores', () => {
  it('la insignia de Consultas suma las de hoy por atender y las atrasadas; la de Agenda, las sin próxima consulta', async () => {
    const lector = {
      referenciasPendientes: jest
        .fn()
        .mockResolvedValue([{} as ReferenciaBandejaMedicaDto]),
      sinProxima: jest
        .fn()
        .mockResolvedValue([
          {} as SinProximaConsultaDto,
          {} as SinProximaConsultaDto,
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
