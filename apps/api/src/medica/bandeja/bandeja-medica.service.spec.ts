/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type {
  CitaAgendaMedicaDto,
  ReferenciaBandejaMedicaDto,
  ReservaCasoDto,
} from '@akyuam/shared';
import type { IReloj } from '../../common/reloj';
import type { AccesoMedicaService } from '../compartido/acceso-medica.service';
import type { ReservasMedica } from '../compartido/reservas';
import type { PorRegistrarService } from '../consultas/por-registrar.service';
import type { ILectorPendientesMedica } from '../interfaces/agenda-medica-repository.interface';
import { BandejaMedicaService } from './bandeja-medica.service';

// El RedisService real arrastra @nestjs/config (ESM): aquí no se usa.
jest.mock('../../redis/redis.service', () => ({ RedisService: class {} }));

const CITA = {} as CitaAgendaMedicaDto;
// 10 de enero de 2027 a las 10:00 en Guatemala.
const RELOJ: IReloj = { ahora: () => new Date('2027-01-10T16:00:00Z') };
const PERSONAL = { id: 'medica-1', nombreCompleto: 'Médica Ficticia' };

function crearReservas() {
  return {
    vigentes: jest.fn(),
    reservar: jest.fn().mockResolvedValue(undefined),
    liberar: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<ReservasMedica>;
}

function crearAcceso() {
  return {
    exigirReferencia: jest.fn().mockResolvedValue({ referidoId: 'r-1' }),
  } as unknown as jest.Mocked<AccesoMedicaService>;
}

describe('BandejaMedicaService.contadores', () => {
  it('Consultas suma las de hoy por atender y las atrasadas; sinProxima es el total de la lista, con el corte de hoy', async () => {
    const lector = {
      contarReferenciasPendientes: jest.fn().mockResolvedValue(1),
      conteosSinProxima: jest.fn().mockResolvedValue({
        TODAS: 7,
        NO_ASISTIO: 2,
        SIN_FECHA: 1,
        SIN_VENIR: 4,
      }),
    } as unknown as jest.Mocked<ILectorPendientesMedica>;
    const porRegistrar = {
      listar: jest.fn().mockResolvedValue({
        hoy: [CITA, CITA],
        atrasadas: [CITA],
        totalAtrasadas: 1,
      }),
    } as unknown as PorRegistrarService;
    const service = new BandejaMedicaService(
      lector,
      porRegistrar,
      RELOJ,
      crearAcceso(),
      crearReservas(),
    );

    await expect(service.contadores()).resolves.toEqual({
      areaAtencion: 1,
      consultasPorRegistrar: 3,
      sinProxima: 7,
    });
    expect(lector.conteosSinProxima).toHaveBeenCalledWith({
      corte: {
        fecha: '2026-11-10',
        instante: new Date('2026-11-11T06:00:00Z'),
      },
    });
  });
});

describe('BandejaMedicaService: reserva de la referencia', () => {
  let lector: jest.Mocked<ILectorPendientesMedica>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let reservas: jest.Mocked<ReservasMedica>;
  let service: BandejaMedicaService;

  beforeEach(() => {
    lector = {
      referenciasPendientes: jest.fn(),
    } as unknown as jest.Mocked<ILectorPendientesMedica>;
    acceso = crearAcceso();
    reservas = crearReservas();
    service = new BandejaMedicaService(
      lector,
      {} as PorRegistrarService,
      RELOJ,
      acceso,
      reservas,
    );
  });

  it('cada tarjeta lleva la reserva vigente de su referencia, en el mismo orden', async () => {
    const reserva: ReservaCasoDto = {
      nombre: 'Médica Ficticia',
      desde: '2027-01-10T16:00:00.000Z',
      motivo: 'AGENDANDO',
      propia: false,
    };
    lector.referenciasPendientes.mockResolvedValue([
      { referidoId: 'r-1' },
      { referidoId: 'r-2' },
    ] as Omit<ReferenciaBandejaMedicaDto, 'reserva'>[]);
    reservas.vigentes.mockResolvedValue([null, reserva]);

    await expect(service.pendientes('medica-1')).resolves.toEqual([
      { referidoId: 'r-1', reserva: null },
      { referidoId: 'r-2', reserva },
    ]);
    expect(reservas.vigentes).toHaveBeenCalledWith(['r-1', 'r-2'], 'medica-1');
  });

  it('reserva como AGENDANDO tras validar el acceso a la referencia', async () => {
    await service.reservar('r-1', PERSONAL);

    expect(acceso.exigirReferencia).toHaveBeenCalledWith('r-1');
    expect(reservas.reservar).toHaveBeenCalledWith(
      'r-1',
      PERSONAL,
      'AGENDANDO',
    );
  });

  it('sin acceso a la referencia no reserva', async () => {
    acceso.exigirReferencia.mockRejectedValue(new ForbiddenException());

    await expect(service.reservar('r-1', PERSONAL)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(reservas.reservar).not.toHaveBeenCalled();
  });

  it('libera solo la reserva de quien la pide', async () => {
    await service.liberar('r-1', 'medica-1');

    expect(reservas.liberar).toHaveBeenCalledWith('r-1', 'medica-1');
  });
});
