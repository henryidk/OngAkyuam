import type {
  CitaAgendaMedicaDto,
  ReferenciaBandejaMedicaDto,
} from '@akyuam/shared';
import type { IReloj } from '../../common/reloj';
import type { PorAtenderService } from '../consultas/por-atender.service';
import type { ILectorPendientesMedica } from '../interfaces/agenda-medica-repository.interface';
import { BandejaMedicaService } from './bandeja-medica.service';

const CITA = {} as CitaAgendaMedicaDto;

describe('BandejaMedicaService.contadores', () => {
  it('Consultas suma las de hoy por atender y las atrasadas; sinProxima es el total de la lista, con el corte de hoy', async () => {
    const lector = {
      referenciasPendientes: jest
        .fn()
        .mockResolvedValue([{} as ReferenciaBandejaMedicaDto]),
      conteosSinProxima: jest.fn().mockResolvedValue({
        TODAS: 7,
        NO_ASISTIO: 2,
        SIN_FECHA: 1,
        SIN_VENIR: 4,
      }),
    } as unknown as jest.Mocked<ILectorPendientesMedica>;
    const porAtender = {
      listar: jest
        .fn()
        .mockResolvedValue({ hoy: [CITA, CITA], atrasadas: [CITA] }),
    } as unknown as PorAtenderService;
    // 10 de enero de 2027 a las 10:00 en Guatemala.
    const reloj: IReloj = { ahora: () => new Date('2027-01-10T16:00:00Z') };
    const service = new BandejaMedicaService(lector, porAtender, reloj);

    await expect(service.contadores()).resolves.toEqual({
      areaAtencion: 1,
      consultasPorAtender: 3,
      sinProxima: 7,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(lector.conteosSinProxima).toHaveBeenCalledWith({
      corte: {
        fecha: '2026-11-10',
        instante: new Date('2026-11-11T06:00:00Z'),
      },
    });
  });
});
