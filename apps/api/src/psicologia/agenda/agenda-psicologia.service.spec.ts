/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { IAgendaPsicologiaRepository } from '../interfaces/agenda-psicologia-repository.interface';
import {
  CITA_ID,
  contexto,
  crearAcceso,
  crearAuditService,
  crearBandejaRepository,
  crearCitasRepository,
  crearProcesosRepository,
  eventosAuditados,
  EXPEDIENTE_ID,
  PROCESO_ID,
} from '../pruebas/dobles';
import { AgendaPsicologiaService } from './agenda-psicologia.service';

// "Ahora" fijo: miércoles 2026-10-07, 10:05 en Guatemala (16:05 UTC).
const AHORA = new Date('2026-10-07T16:05:00.000Z');

describe('AgendaPsicologiaService', () => {
  let agendaRepository: jest.Mocked<IAgendaPsicologiaRepository>;
  let citasRepository: ReturnType<typeof crearCitasRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: AgendaPsicologiaService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AHORA);
    agendaRepository = {
      listarCitas: jest.fn().mockResolvedValue([]),
      listarOcupadas: jest.fn().mockResolvedValue([]),
      marcarNoAsistio: jest.fn().mockResolvedValue(true),
    };
    citasRepository = crearCitasRepository();
    auditService = crearAuditService();
    service = new AgendaPsicologiaService(
      agendaRepository,
      crearAcceso(
        crearBandejaRepository(),
        crearProcesosRepository(),
        citasRepository,
      ),
      auditService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('citas', () => {
    it('pide solo la agenda de quien consulta, con los días completos de Guatemala', async () => {
      await service.listarCitas(
        { desde: '2026-10-05', hasta: '2026-10-09' },
        'psicologa-a',
      );

      expect(agendaRepository.listarCitas).toHaveBeenCalledWith({
        psicologaId: 'psicologa-a',
        desde: new Date('2026-10-05T06:00:00.000Z'),
        hasta: new Date('2026-10-10T05:59:59.999Z'),
        ahora: AHORA,
      });
    });

    it.each([
      ['al revés', '2026-10-09', '2026-10-05'],
      ['de más de seis semanas', '2026-01-01', '2026-12-31'],
    ])('rechaza con 400 un rango %s', (_caso, desde, hasta) => {
      expect(() =>
        service.listarCitas({ desde, hasta }, 'psicologa-a'),
      ).toThrow(BadRequestException);
      expect(agendaRepository.listarCitas).not.toHaveBeenCalled();
    });
  });

  describe('huecos libres', () => {
    it('un día pasado no ofrece huecos ni consulta la agenda', async () => {
      await expect(
        service.huecos({ fecha: '2026-10-06' }, 'psicologa-a'),
      ).resolves.toEqual([]);
      expect(agendaRepository.listarOcupadas).not.toHaveBeenCalled();
    });

    it('hoy arranca en el siguiente cuarto de hora y descuenta las citas propias', async () => {
      // 14:00–14:45 de Guatemala.
      agendaRepository.listarOcupadas.mockResolvedValue([
        {
          fechaHora: new Date('2026-10-07T20:00:00.000Z'),
          duracionMinutos: 45,
        },
      ]);

      await expect(
        service.huecos({ fecha: '2026-10-07' }, 'psicologa-a'),
      ).resolves.toEqual([
        { desdeMin: 10 * 60 + 15, hastaMin: 12 * 60 },
        { desdeMin: 13 * 60, hastaMin: 14 * 60 },
        { desdeMin: 14 * 60 + 45, hastaMin: 17 * 60 },
      ]);
      expect(agendaRepository.listarOcupadas).toHaveBeenCalledWith({
        psicologaId: 'psicologa-a',
        desde: new Date('2026-10-07T06:00:00.000Z'),
        hasta: new Date('2026-10-08T05:59:59.999Z'),
      });
    });

    it('un día futuro ofrece la jornada completa menos el almuerzo', async () => {
      await expect(
        service.huecos({ fecha: '2026-10-08' }, 'psicologa-a'),
      ).resolves.toEqual([
        { desdeMin: 8 * 60, hastaMin: 12 * 60 },
        { desdeMin: 13 * 60, hastaMin: 17 * 60 },
      ]);
    });

    it('el fin de semana no ofrece huecos', async () => {
      await expect(
        service.huecos({ fecha: '2026-10-10' }, 'psicologa-a'),
      ).resolves.toEqual([]);
    });
  });

  describe('marcar no asistió', () => {
    it('rechaza con 403 la cita de otra psicóloga, sin tocarla ni auditar', async () => {
      citasRepository.buscarAccesoCita.mockResolvedValue(null);

      await expect(
        service.marcarNoAsistio(CITA_ID, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(citasRepository.buscarAccesoCita).toHaveBeenCalledWith(
        CITA_ID,
        'psicologa-a',
      );
      expect(agendaRepository.marcarNoAsistio).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('marca la cita y lo audita solo con ids', async () => {
      await expect(service.marcarNoAsistio(CITA_ID, contexto)).resolves.toEqual(
        { id: CITA_ID, estado: 'NO_ASISTIO' },
      );
      expect(agendaRepository.marcarNoAsistio).toHaveBeenCalledWith(
        CITA_ID,
        AHORA,
      );
      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'CITA_PSICOLOGICA_NO_ASISTIO',
          entidadId: CITA_ID,
          detalles: { expedienteId: EXPEDIENTE_ID, procesoId: PROCESO_ID },
        }),
      ]);
    });

    it('responde 409 si la cita ya se registró o todavía no ocurre, sin auditar', async () => {
      agendaRepository.marcarNoAsistio.mockResolvedValue(false);

      await expect(
        service.marcarNoAsistio(CITA_ID, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });
});
