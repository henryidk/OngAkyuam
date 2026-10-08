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
  NINO_ID,
  PROCESO_ID,
  procesoConAcceso,
} from '../pruebas/dobles';
import { AgendaPsicologiaService } from './agenda-psicologia.service';

// "Ahora" fijo: miércoles 2026-10-07, 10:05 en Guatemala (16:05 UTC).
const AHORA = new Date('2026-10-07T16:05:00.000Z');
const CITA_NUEVA_ID = '77777777-7777-4777-8777-777777777777';
// Jueves 2026-10-08, 09:00 en Guatemala (15:00 UTC).
const NUEVA_FECHA = new Date('2026-10-08T15:00:00.000Z');
const DATOS_CITA = {
  fechaHora: '2026-10-08T09:00',
  duracionMinutos: 45 as const,
  ninoId: null,
  confirmarTraslape: false,
};
const DATOS_MOVER = {
  fechaHora: '2026-10-08T09:00',
  duracionMinutos: 60 as const,
  confirmarTraslape: false,
};

describe('AgendaPsicologiaService', () => {
  let agendaRepository: jest.Mocked<IAgendaPsicologiaRepository>;
  let citasRepository: ReturnType<typeof crearCitasRepository>;
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: AgendaPsicologiaService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(AHORA);
    agendaRepository = {
      listarCitas: jest.fn().mockResolvedValue([]),
      listarOcupadas: jest.fn().mockResolvedValue([]),
      marcarNoAsistio: jest.fn().mockResolvedValue(true),
      listarProcesosParaAgendar: jest.fn().mockResolvedValue([]),
      programarCita: jest.fn().mockResolvedValue(CITA_NUEVA_ID),
      moverCita: jest.fn().mockResolvedValue(CITA_NUEVA_ID),
    };
    citasRepository = crearCitasRepository();
    procesosRepository = crearProcesosRepository();
    auditService = crearAuditService();
    service = new AgendaPsicologiaService(
      agendaRepository,
      citasRepository,
      procesosRepository,
      crearAcceso(
        crearBandejaRepository(),
        procesosRepository,
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

  describe('procesos para agendar', () => {
    it('pide solo los procesos de quien consulta', async () => {
      await service.listarProcesosParaAgendar('psicologa-a');

      expect(agendaRepository.listarProcesosParaAgendar).toHaveBeenCalledWith(
        'psicologa-a',
        AHORA,
      );
    });
  });

  describe('programar cita en un proceso', () => {
    it('rechaza con 403 el proceso de otra psicóloga, sin crear nada ni auditar', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

      await expect(
        service.programarCita(PROCESO_ID, DATOS_CITA, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(procesosRepository.buscarAccesoProceso).toHaveBeenCalledWith(
        PROCESO_ID,
        'psicologa-a',
      );
      expect(citasRepository.buscarCitasSolapadas).not.toHaveBeenCalled();
      expect(agendaRepository.programarCita).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('responde 409 si el proceso ya está cerrado', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(
        procesoConAcceso({ etapa: 'CIERRE' }),
      );

      await expect(
        service.programarCita(PROCESO_ID, DATOS_CITA, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(agendaRepository.programarCita).not.toHaveBeenCalled();
    });

    it('rechaza con 400 a un niño que no es del expediente del proceso', async () => {
      procesosRepository.ninoPerteneceAExpediente.mockResolvedValue(false);

      await expect(
        service.programarCita(
          PROCESO_ID,
          { ...DATOS_CITA, ninoId: NINO_ID },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.ninoPerteneceAExpediente).toHaveBeenCalledWith(
        NINO_ID,
        EXPEDIENTE_ID,
      );
      expect(agendaRepository.programarCita).not.toHaveBeenCalled();
    });

    it('avisa del traslape con 409 y su código, y no crea la cita', async () => {
      citasRepository.buscarCitasSolapadas.mockResolvedValue([
        { id: CITA_ID } as never,
      ]);

      await expect(
        service.programarCita(PROCESO_ID, DATOS_CITA, contexto),
      ).rejects.toMatchObject({
        response: { codigo: 'TRASLAPE_CITA', detalle: { citas: [{}] } },
      });
      expect(citasRepository.buscarCitasSolapadas).toHaveBeenCalledWith({
        psicologaId: 'psicologa-a',
        fechaHora: NUEVA_FECHA,
        duracionMinutos: 45,
        excluirCitaId: undefined,
      });
      expect(agendaRepository.programarCita).not.toHaveBeenCalled();
    });

    it('con el traslape confirmado crea la cita para el niño y lo audita solo con ids', async () => {
      await expect(
        service.programarCita(
          PROCESO_ID,
          { ...DATOS_CITA, ninoId: NINO_ID, confirmarTraslape: true },
          contexto,
        ),
      ).resolves.toEqual({
        id: CITA_NUEVA_ID,
        procesoId: PROCESO_ID,
        fechaHora: NUEVA_FECHA.toISOString(),
      });
      expect(citasRepository.buscarCitasSolapadas).not.toHaveBeenCalled();
      expect(agendaRepository.programarCita).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        psicologaId: 'psicologa-a',
        fechaHora: NUEVA_FECHA,
        duracionMinutos: 45,
        ninoId: NINO_ID,
      });
      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'CITA_PSICOLOGICA_PROGRAMADA',
          entidadId: CITA_NUEVA_ID,
          detalles: { expedienteId: EXPEDIENTE_ID, procesoId: PROCESO_ID },
        }),
      ]);
    });

    it('responde 409 sin auditar si el proceso se cerró mientras se programaba', async () => {
      agendaRepository.programarCita.mockResolvedValue(null);

      await expect(
        service.programarCita(PROCESO_ID, DATOS_CITA, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('mover cita', () => {
    it('rechaza con 403 la cita de otra psicóloga, sin tocarla ni auditar', async () => {
      citasRepository.buscarAccesoCita.mockResolvedValue(null);

      await expect(
        service.moverCita(CITA_ID, DATOS_MOVER, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(citasRepository.buscarAccesoCita).toHaveBeenCalledWith(
        CITA_ID,
        'psicologa-a',
      );
      expect(agendaRepository.moverCita).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('revisa el traslape sin contar la propia cita y avisa con 409', async () => {
      citasRepository.buscarCitasSolapadas.mockResolvedValue([
        { id: CITA_NUEVA_ID } as never,
      ]);

      await expect(
        service.moverCita(CITA_ID, DATOS_MOVER, contexto),
      ).rejects.toMatchObject({ response: { codigo: 'TRASLAPE_CITA' } });
      expect(citasRepository.buscarCitasSolapadas).toHaveBeenCalledWith({
        psicologaId: 'psicologa-a',
        fechaHora: NUEVA_FECHA,
        duracionMinutos: 60,
        excluirCitaId: CITA_ID,
      });
      expect(agendaRepository.moverCita).not.toHaveBeenCalled();
    });

    it('mueve la cita y lo audita solo con ids', async () => {
      await expect(
        service.moverCita(CITA_ID, DATOS_MOVER, contexto),
      ).resolves.toEqual({
        id: CITA_NUEVA_ID,
        procesoId: PROCESO_ID,
        fechaHora: NUEVA_FECHA.toISOString(),
      });
      expect(agendaRepository.moverCita).toHaveBeenCalledWith({
        citaId: CITA_ID,
        psicologaId: 'psicologa-a',
        fechaHora: NUEVA_FECHA,
        duracionMinutos: 60,
      });
      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'CITA_PSICOLOGICA_REPROGRAMADA',
          entidadId: CITA_NUEVA_ID,
          detalles: {
            expedienteId: EXPEDIENTE_ID,
            procesoId: PROCESO_ID,
            citaAnteriorId: CITA_ID,
          },
        }),
      ]);
    });

    it('responde 409 sin auditar si la cita ya no estaba programada', async () => {
      agendaRepository.moverCita.mockResolvedValue(null);

      await expect(
        service.moverCita(CITA_ID, DATOS_MOVER, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });
});
