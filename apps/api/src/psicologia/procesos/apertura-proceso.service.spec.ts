/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { agendarCitaPsicologicaSchema } from '@akyuam/shared';
import type { AgendarCitaPsicologicaInput } from '@akyuam/shared';
import {
  OtroProcesoActivoError,
  ProcesoNoDisponibleError,
  ProcesoYaAbiertoError,
} from '../interfaces/procesos-psicologia-repository.interface';
import {
  CITA_ID,
  contexto,
  crearAcceso,
  crearAuditService,
  crearBandejaRepository,
  crearCitasRepository,
  crearProcesosRepository,
  crearRedis,
  eventosAuditados,
  EXPEDIENTE_ID,
  NINO_ID,
  PROCESO_ID,
  referencia,
  REFERIDO_ID,
  USUARIA_ID,
} from '../pruebas/dobles';
import { AperturaProcesoService } from './apertura-proceso.service';

// El módulo real de Redis arrastra `@nestjs/config` (ESM), que Jest no puede cargar; aquí
// solo hace falta su tipo, y el doble en memoria ocupa su lugar.
jest.mock('../../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

// 2026-10-07 es miércoles; 09:00 de Guatemala = 15:00 UTC.
function datos(
  parcial: Partial<AgendarCitaPsicologicaInput> = {},
): AgendarCitaPsicologicaInput {
  return {
    ...agendarCitaPsicologicaSchema.parse({ fechaHora: '2026-10-07T09:00' }),
    ...parcial,
  };
}

describe('AperturaProcesoService', () => {
  let bandejaRepository: ReturnType<typeof crearBandejaRepository>;
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let citasRepository: ReturnType<typeof crearCitasRepository>;
  let redis: ReturnType<typeof crearRedis>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: AperturaProcesoService;

  beforeEach(() => {
    bandejaRepository = crearBandejaRepository();
    procesosRepository = crearProcesosRepository();
    citasRepository = crearCitasRepository();
    redis = crearRedis();
    auditService = crearAuditService();
    service = new AperturaProcesoService(
      procesosRepository,
      citasRepository,
      crearAcceso(bandejaRepository, procesosRepository),
      redis,
      auditService,
    );
  });

  it('abre el proceso con la primera cita y devuelve su código', async () => {
    await expect(
      service.atender(REFERIDO_ID, datos(), contexto),
    ).resolves.toEqual({
      procesoId: PROCESO_ID,
      codigo: 'P1-05-2026',
      citaId: CITA_ID,
    });
    expect(procesosRepository.abrir).toHaveBeenCalledWith({
      procesoId: PROCESO_ID,
      psicologaId: 'psicologa-a',
      usuariaId: USUARIA_ID,
      fechaHora: new Date('2026-10-07T15:00:00.000Z'),
      duracionMinutos: 45,
      ninoId: null,
    });
  });

  it('audita la apertura solo con ids', async () => {
    await service.atender(REFERIDO_ID, datos(), contexto);

    expect(eventosAuditados(auditService)).toEqual([
      expect.objectContaining({
        accion: 'PROCESO_PSICOLOGICO_ABIERTO',
        entidadId: PROCESO_ID,
        detalles: {
          expedienteId: EXPEDIENTE_ID,
          procesoId: PROCESO_ID,
          citaId: CITA_ID,
        },
      }),
    ]);
  });

  describe('acceso', () => {
    it('rechaza con 403 el caso de otra psicóloga, sin abrir ni auditar', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(
        referencia({ situacion: 'NO_DISPONIBLE', procesoId: null }),
      );

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('rechaza con 403 una referencia inexistente', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(null);

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('exige tomar el caso antes de agendar (409)', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(
        referencia({ situacion: 'SIN_TOMAR', procesoId: null }),
      );

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
    });

    it('no devuelve una respuesta guardada a quien ya no tiene el caso', async () => {
      await service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001');
      bandejaRepository.buscarReferencia.mockResolvedValue(
        referencia({ situacion: 'NO_DISPONIBLE', procesoId: null }),
      );

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('validaciones', () => {
    it('acepta la hora que elija la psicóloga, aunque sea fuera del horario habitual', async () => {
      // Sábado a las 19:00: si ella la agenda, se atiende.
      await service.atender(
        REFERIDO_ID,
        datos({ fechaHora: '2026-10-10T19:00' }),
        contexto,
      );

      expect(procesosRepository.abrir).toHaveBeenCalledWith(
        expect.objectContaining({
          fechaHora: new Date('2026-10-11T01:00:00.000Z'),
        }),
      );
    });

    it('rechaza con 400 un niño que no es de este expediente', async () => {
      procesosRepository.ninoPerteneceAExpediente.mockResolvedValue(false);

      await expect(
        service.atender(REFERIDO_ID, datos({ ninoId: NINO_ID }), contexto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.ninoPerteneceAExpediente).toHaveBeenCalledWith(
        NINO_ID,
        EXPEDIENTE_ID,
      );
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
    });

    it('agenda para un hijo/a del expediente', async () => {
      await service.atender(REFERIDO_ID, datos({ ninoId: NINO_ID }), contexto);

      expect(procesosRepository.abrir).toHaveBeenCalledWith(
        expect.objectContaining({ ninoId: NINO_ID }),
      );
    });
  });

  describe('traslape', () => {
    const solapada = { id: 'cita-otra' };

    beforeEach(() => {
      (citasRepository.buscarCitasSolapadas as jest.Mock).mockResolvedValue([
        solapada,
      ]);
    });

    it('avisa con 409 y la lista de citas en conflicto, solo de la propia agenda', async () => {
      const error: unknown = await service
        .atender(REFERIDO_ID, datos(), contexto)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        mensaje: 'Ya existe una cita programada en ese horario',
        citasEnConflicto: [solapada],
      });
      expect(citasRepository.buscarCitasSolapadas).toHaveBeenCalledWith(
        expect.objectContaining({ psicologaId: 'psicologa-a' }),
      );
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
    });

    it('agenda igual si la psicóloga confirmó el traslape', async () => {
      await service.atender(
        REFERIDO_ID,
        datos({ confirmarTraslape: true }),
        contexto,
      );

      expect(procesosRepository.abrir).toHaveBeenCalled();
    });
  });

  describe('carreras detectadas en la transacción', () => {
    it.each([
      [new ProcesoNoDisponibleError(), ForbiddenException],
      [new ProcesoYaAbiertoError(), ConflictException],
      [new OtroProcesoActivoError(), ConflictException],
    ])('traduce %p', async (error, excepcion) => {
      procesosRepository.abrir.mockRejectedValue(error);

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(excepcion);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('deja pasar un error inesperado sin disfrazarlo', async () => {
      procesosRepository.abrir.mockRejectedValue(new Error('caída'));

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toThrow('caída');
    });
  });

  describe('idempotencia', () => {
    it('un doble envío con la misma clave no abre dos veces', async () => {
      const primera = await service.atender(
        REFERIDO_ID,
        datos(),
        contexto,
        'clave-0001',
      );
      const segunda = await service.atender(
        REFERIDO_ID,
        datos(),
        contexto,
        'clave-0001',
      );

      expect(segunda).toEqual(primera);
      expect(procesosRepository.abrir).toHaveBeenCalledTimes(1);
      expect(auditService.registrar).toHaveBeenCalledTimes(1);
    });

    it('la clave queda atada a la psicóloga y a la referencia', async () => {
      await service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001');

      expect([...redis.datos.keys()]).toEqual([
        `psicologia:atender:psicologa-a:${REFERIDO_ID}:clave-0001`,
      ]);
    });

    it('rechaza con 400 una clave con formato inválido', async () => {
      await expect(
        service.atender(REFERIDO_ID, datos(), contexto, 'a b'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
    });
  });
});
