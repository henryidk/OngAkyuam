/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  abrirProcesosPsicologiaSchema,
  atenderAhoraSchema,
} from '@akyuam/shared';
import type {
  AbrirProcesosPsicologiaInput,
  AtenderAhoraInput,
} from '@akyuam/shared';
import { IdempotenciaPsicologia } from '../compartido/idempotencia';
import {
  CasoYaTomadoError,
  OtroProcesoActivoError,
  ProcesoNoDisponibleError,
  ReferenciaPendienteError,
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
  crearReservas,
  eventosAuditados,
  EXPEDIENTE_ID,
  NINO_ID,
  PROCESO_ID,
  referencia,
  REFERIDO_ID,
  USUARIA_ID,
} from '../pruebas/dobles';
import { AperturaProcesoService } from './apertura-proceso.service';

const RESERVA_AJENA = new ConflictException(
  'Psicóloga Ficticia le está agendando cita. Espera a que termine.',
);

// El módulo real de Redis arrastra `@nestjs/config` (ESM), que Jest no puede cargar; aquí
// solo hace falta su tipo, y el doble en memoria ocupa su lugar.
jest.mock('../../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

// Hora del servidor en "atender ahora": 2026-11-08 10:20 de Guatemala.
const AHORA = new Date('2026-11-08T16:20:00.000Z');

// Datos clínicos ficticios: sirven para comprobar que nunca llegan a la auditoría.
const TEXTO_CLINICO = 'Texto clínico ficticio';

function sesionAhora(
  parcial: {
    ninoId?: string | null;
    siguiente?: unknown;
    estado?: string;
  } = {},
): AtenderAhoraInput {
  return atenderAhoraSchema.parse({
    ninoId: parcial.ninoId ?? null,
    duracionMinutos: 60,
    registro: {
      estado: parcial.estado ?? 'ATENDIDA',
      temas: TEXTO_CLINICO,
      intervencion: '',
      diagnostico: TEXTO_CLINICO,
      acuerdos: '',
      observaciones: '',
      motivoNoAsistencia: parcial.estado ? 'No llegó' : '',
      clinica: 'CLINICA_1',
      enfoqueTerapeutico: '',
      atencionBrindada: TEXTO_CLINICO,
      ...(parcial.siguiente ? { siguiente: parcial.siguiente } : {}),
    },
  });
}

// 2026-11-10 09:00 de Guatemala = 15:00 UTC.
const PROGRAMAR_PROXIMA = {
  tipo: 'PROGRAMAR',
  fechaHora: '2026-11-10T09:00',
  duracionMinutos: 45,
};

// Un segundo hijo/a ficticio del mismo expediente.
const NINO_2_ID = '66666666-6666-4666-8666-666666666666';

// 2026-10-07 es miércoles; 09:00 de Guatemala = 15:00 UTC.
interface Persona {
  ninoId?: string | null;
  fechaHora?: string;
}

/** Por defecto, solo la usuaria a las 09:00. */
function datos(
  parcial: Partial<Omit<AbrirProcesosPsicologiaInput, 'personas'>> & {
    personas?: Persona[];
    ninoId?: string | null;
    fechaHora?: string;
  } = {},
): AbrirProcesosPsicologiaInput {
  const { personas, ninoId, fechaHora, ...resto } = parcial;
  return abrirProcesosPsicologiaSchema.parse({
    personas: (personas ?? [{ ninoId, fechaHora }]).map((persona) => ({
      ninoId: persona.ninoId ?? null,
      fechaHora: persona.fechaHora ?? '2026-10-07T09:00',
    })),
    ...resto,
  });
}

describe('AperturaProcesoService', () => {
  let bandejaRepository: ReturnType<typeof crearBandejaRepository>;
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let citasRepository: ReturnType<typeof crearCitasRepository>;
  let redis: ReturnType<typeof crearRedis>;
  let reservas: ReturnType<typeof crearReservas>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: AperturaProcesoService;

  beforeEach(() => {
    bandejaRepository = crearBandejaRepository();
    procesosRepository = crearProcesosRepository();
    citasRepository = crearCitasRepository();
    redis = crearRedis();
    reservas = crearReservas();
    auditService = crearAuditService();
    service = new AperturaProcesoService(
      procesosRepository,
      citasRepository,
      crearAcceso(bandejaRepository, procesosRepository),
      new IdempotenciaPsicologia(redis),
      reservas,
      auditService,
      { ahora: () => AHORA },
    );
  });

  it('abre el proceso con la primera cita y devuelve su código', async () => {
    await expect(
      service.atender(REFERIDO_ID, datos(), contexto),
    ).resolves.toEqual({
      procesos: [
        {
          procesoId: PROCESO_ID,
          codigo: '05-2026',
          ninoId: null,
          citaId: CITA_ID,
        },
      ],
    });
    expect(procesosRepository.abrir).toHaveBeenCalledWith({
      expedienteId: EXPEDIENTE_ID,
      referidoId: REFERIDO_ID,
      psicologaId: 'psicologa-a',
      usuariaId: USUARIA_ID,
      personas: [
        {
          ninoId: null,
          fechaHora: new Date('2026-10-07T15:00:00.000Z'),
          duracionMinutos: 45,
        },
      ],
    });
  });

  it('toma el caso al confirmar la cita y audita la toma y la apertura solo con ids', async () => {
    await service.atender(REFERIDO_ID, datos(), contexto);

    expect(eventosAuditados(auditService)).toEqual([
      expect.objectContaining({
        accion: 'CASO_PSICOLOGIA_TOMADO',
        entidad: 'AtencionPsicologica',
        entidadId: PROCESO_ID,
        detalles: { expedienteId: EXPEDIENTE_ID, referidoId: REFERIDO_ID },
      }),
      expect.objectContaining({
        accion: 'PROCESO_PSICOLOGICO_ABIERTO',
        entidadId: PROCESO_ID,
        detalles: {
          expedienteId: EXPEDIENTE_ID,
          procesoId: PROCESO_ID,
          citaId: CITA_ID,
          ninoId: null,
          origen: 'REFERENCIA',
        },
      }),
    ]);
  });

  describe('acceso', () => {
    it('rechaza con 409 el caso que ya tomó alguien, sin abrir ni auditar', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(
        referencia({ situacion: 'TOMADA' }),
      );

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('rechaza con 403 una referencia inexistente', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(null);

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza con 409 el caso que otra persona tiene reservado, sin abrir', async () => {
      reservas.exigirSinReservaAjena.mockRejectedValue(RESERVA_AJENA);

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toBe(RESERVA_AJENA);
      expect(reservas.exigirSinReservaAjena).toHaveBeenCalledWith(
        REFERIDO_ID,
        'psicologa-a',
      );
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
    });

    it('al confirmar libera la reserva propia', async () => {
      await service.atender(REFERIDO_ID, datos(), contexto);

      expect(reservas.liberar).toHaveBeenCalledWith(REFERIDO_ID, 'psicologa-a');
    });

    it('si no se pudo agendar, la reserva sigue: la pantalla decide si reintenta o sale', async () => {
      procesosRepository.abrir.mockRejectedValue(new CasoYaTomadoError());

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(reservas.liberar).not.toHaveBeenCalled();
    });

    it('el reintento con la misma clave devuelve la respuesta guardada, aunque el caso ya quedó tomado', async () => {
      const primera = await service.atender(
        REFERIDO_ID,
        datos(),
        contexto,
        'clave-0001',
      );
      bandejaRepository.buscarReferencia.mockResolvedValue(
        referencia({ situacion: 'TOMADA' }),
      );

      await expect(
        service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001'),
      ).resolves.toEqual(primera);
      expect(procesosRepository.abrir).toHaveBeenCalledTimes(1);
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
          personas: [
            expect.objectContaining({
              fechaHora: new Date('2026-10-11T01:00:00.000Z'),
            }),
          ],
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

    it('abre el proceso del hijo/a elegido, con su número propio', async () => {
      await expect(
        service.atender(REFERIDO_ID, datos({ ninoId: NINO_ID }), contexto),
      ).resolves.toMatchObject({ procesos: [{ codigo: '05-2026.01' }] });
      expect(procesosRepository.abrir).toHaveBeenCalledWith(
        expect.objectContaining({
          personas: [expect.objectContaining({ ninoId: NINO_ID })],
        }),
      );
      expect(eventosAuditados(auditService)[1]).toMatchObject({
        accion: 'PROCESO_PSICOLOGICO_ABIERTO',
        detalles: { ninoId: NINO_ID },
      });
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
        message: 'Ya existe una cita programada en ese horario',
        codigo: 'TRASLAPE_CITA',
        detalle: { citas: [solapada] },
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
      [new CasoYaTomadoError(), ConflictException],
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
      // La toma y la apertura, una sola vez.
      expect(auditService.registrar).toHaveBeenCalledTimes(2);
    });

    it('la clave queda atada a la psicóloga y a la referencia', async () => {
      await service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001');

      expect([...redis.datos.keys()]).toEqual([
        `psicologia:atender:${REFERIDO_ID}:usuaria:psicologa-a:clave-0001`,
      ]);
    });

    it('rechaza con 400 una clave con formato inválido', async () => {
      await expect(
        service.atender(REFERIDO_ID, datos(), contexto, 'a b'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
    });
  });

  describe('abrir desde la ficha de la usuaria', () => {
    it('abre un proceso más en el expediente que ya atendía, con su primera cita', async () => {
      await expect(
        service.abrirDesdeFicha(USUARIA_ID, datos(), contexto),
      ).resolves.toEqual({
        procesos: [
          {
            procesoId: PROCESO_ID,
            codigo: '05-2026 · Proceso 2',
            ninoId: null,
            citaId: CITA_ID,
          },
        ],
      });
      expect(procesosRepository.abrirNuevo).toHaveBeenCalledWith({
        usuariaId: USUARIA_ID,
        psicologaId: 'psicologa-a',
        personas: [
          {
            expedienteId: EXPEDIENTE_ID,
            ninoId: null,
            fechaHora: new Date('2026-10-07T15:00:00.000Z'),
            duracionMinutos: 45,
          },
        ],
      });
      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'PROCESO_PSICOLOGICO_ABIERTO',
          entidadId: PROCESO_ID,
          detalles: {
            expedienteId: EXPEDIENTE_ID,
            procesoId: PROCESO_ID,
            citaId: CITA_ID,
            ninoId: null,
            origen: 'FICHA',
          },
        }),
      ]);
    });

    it('rechaza con 403 a la usuaria que nunca fue referida a Psicología, sin abrir ni auditar', async () => {
      procesosRepository.buscarAccesoUsuaria.mockResolvedValue(null);

      await expect(
        service.abrirDesdeFicha(USUARIA_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(procesosRepository.buscarAccesoUsuaria).toHaveBeenCalledWith(
        USUARIA_ID,
      );
      expect(
        procesosRepository.buscarExpedienteParaAbrir,
      ).not.toHaveBeenCalled();
      expect(procesosRepository.abrirNuevo).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('no devuelve una respuesta guardada a quien ya no puede ver a la usuaria', async () => {
      const clave = 'clave-abrir-0001';
      await service.abrirDesdeFicha(USUARIA_ID, datos(), contexto, clave);
      procesosRepository.buscarAccesoUsuaria.mockResolvedValue(null);

      await expect(
        service.abrirDesdeFicha(USUARIA_ID, datos(), contexto, clave),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('pide atender la referencia (409) si ningún expediente suyo fue tomado todavía', async () => {
      procesosRepository.buscarExpedienteParaAbrir.mockResolvedValue(
        'SIN_TOMAR',
      );

      await expect(
        service.abrirDesdeFicha(USUARIA_ID, datos(), contexto),
      ).rejects.toEqual(
        new ConflictException(
          'La usuaria tiene una referencia pendiente: atiéndala desde el Área de atención',
        ),
      );
      expect(procesosRepository.abrirNuevo).not.toHaveBeenCalled();
    });

    it('rechaza con 400 un hijo/a que no es de esta usuaria, sin abrir', async () => {
      procesosRepository.buscarExpedienteParaAbrir.mockResolvedValue(
        'PERSONA_AJENA',
      );

      await expect(
        service.abrirDesdeFicha(
          USUARIA_ID,
          datos({ ninoId: NINO_ID }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.buscarExpedienteParaAbrir).toHaveBeenCalledWith(
        USUARIA_ID,
        NINO_ID,
      );
      expect(procesosRepository.abrirNuevo).not.toHaveBeenCalled();
    });

    it('abre el proceso del hijo/a y quien lo abre queda como responsable', async () => {
      procesosRepository.abrirNuevo.mockResolvedValueOnce([
        {
          procesoId: PROCESO_ID,
          ninoId: NINO_ID,
          consecutivo: 1,
          ninoConsecutivo: 2,
          citaId: CITA_ID,
        },
      ]);

      await expect(
        service.abrirDesdeFicha(
          USUARIA_ID,
          datos({ ninoId: NINO_ID }),
          contexto,
        ),
      ).resolves.toMatchObject({ procesos: [{ codigo: '05-2026.02' }] });
      expect(procesosRepository.abrirNuevo).toHaveBeenCalledWith(
        expect.objectContaining({
          psicologaId: 'psicologa-a',
          personas: [expect.objectContaining({ ninoId: NINO_ID })],
        }),
      );
    });

    it.each([
      ['otro proceso activo', new OtroProcesoActivoError(), ConflictException],
      [
        'una referencia pendiente',
        new ReferenciaPendienteError(),
        ConflictException,
      ],
      [
        'un expediente que dejó de ser suyo',
        new ProcesoNoDisponibleError(),
        ForbiddenException,
      ],
    ])('no abre si hay %s', async (_caso, error, excepcion) => {
      procesosRepository.abrirNuevo.mockRejectedValue(error);

      await expect(
        service.abrirDesdeFicha(USUARIA_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(excepcion);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('rechaza con 400 un niño que no es de ese expediente', async () => {
      procesosRepository.ninoPerteneceAExpediente.mockResolvedValue(false);

      await expect(
        service.abrirDesdeFicha(
          USUARIA_ID,
          datos({ ninoId: NINO_ID }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.ninoPerteneceAExpediente).toHaveBeenCalledWith(
        NINO_ID,
        EXPEDIENTE_ID,
      );
      expect(procesosRepository.abrirNuevo).not.toHaveBeenCalled();
    });

    it('avisa del traslape con 409 y agenda si se confirma', async () => {
      citasRepository.buscarCitasSolapadas.mockResolvedValue([
        { id: 'otra-cita' } as never,
      ]);

      await expect(
        service.abrirDesdeFicha(USUARIA_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.abrirDesdeFicha(
          USUARIA_ID,
          datos({ confirmarTraslape: true }),
          contexto,
        ),
      ).resolves.toMatchObject({ procesos: [{ procesoId: PROCESO_ID }] });
    });

    it('un doble envío con la misma clave no abre dos procesos', async () => {
      const clave = 'clave-abrir-0002';
      const primera = await service.abrirDesdeFicha(
        USUARIA_ID,
        datos(),
        contexto,
        clave,
      );
      const segunda = await service.abrirDesdeFicha(
        USUARIA_ID,
        datos(),
        contexto,
        clave,
      );

      expect(segunda).toEqual(primera);
      expect(procesosRepository.abrirNuevo).toHaveBeenCalledTimes(1);
      expect([...redis.datos.keys()]).toEqual([
        `psicologia:abrir:${USUARIA_ID}:usuaria:psicologa-a:${clave}`,
      ]);
    });

    it('la misma clave para otra persona no devuelve la respuesta de la primera', async () => {
      const clave = 'clave-abrir-0003';
      await service.abrirDesdeFicha(USUARIA_ID, datos(), contexto, clave);
      await service.abrirDesdeFicha(
        USUARIA_ID,
        datos({ ninoId: NINO_ID }),
        contexto,
        clave,
      );

      expect(procesosRepository.abrirNuevo).toHaveBeenCalledTimes(2);
    });
  });
  describe('varias personas a la vez', () => {
    it('desde la referencia: la usuaria va primero y cada persona recibe su proceso', async () => {
      const respuesta = await service.atender(
        REFERIDO_ID,
        // El hijo/a viene primero en el envío: el servicio pone a la usuaria al frente.
        datos({
          personas: [
            { ninoId: NINO_ID, fechaHora: '2026-10-07T10:00' },
            { ninoId: null, fechaHora: '2026-10-07T09:00' },
          ],
        }),
        contexto,
      );

      expect(procesosRepository.abrir).toHaveBeenCalledTimes(1);
      expect(procesosRepository.abrir).toHaveBeenCalledWith(
        expect.objectContaining({
          referidoId: REFERIDO_ID,
          personas: [
            expect.objectContaining({ ninoId: null }),
            expect.objectContaining({
              ninoId: NINO_ID,
              fechaHora: new Date('2026-10-07T16:00:00.000Z'),
            }),
          ],
        }),
      );
      expect(respuesta.procesos.map((p) => p.codigo)).toEqual([
        '05-2026',
        '05-2026.02',
      ]);
      // El caso se toma una vez; luego, un evento por proceso abierto.
      expect(eventosAuditados(auditService).map((e) => e.accion)).toEqual([
        'CASO_PSICOLOGIA_TOMADO',
        'PROCESO_PSICOLOGICO_ABIERTO',
        'PROCESO_PSICOLOGICO_ABIERTO',
      ]);
      expect(
        eventosAuditados(auditService)
          .slice(1)
          .map((e) => e.detalles?.ninoId),
      ).toEqual([null, NINO_ID]);
    });

    it('si un hijo/a no es del expediente, no abre ninguno', async () => {
      procesosRepository.ninoPerteneceAExpediente.mockImplementation((ninoId) =>
        Promise.resolve(ninoId === NINO_ID),
      );

      await expect(
        service.atender(
          REFERIDO_ID,
          datos({ personas: [{ ninoId: NINO_ID }, { ninoId: NINO_2_ID }] }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('si la transacción falla por una persona, no audita ninguna', async () => {
      procesosRepository.abrirNuevo.mockRejectedValue(
        new OtroProcesoActivoError(),
      );

      await expect(
        service.abrirDesdeFicha(
          USUARIA_ID,
          datos({ personas: [{ ninoId: null }, { ninoId: NINO_ID }] }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('desde la ficha: resuelve el expediente de cada persona y las abre en un solo paso', async () => {
      const respuesta = await service.abrirDesdeFicha(
        USUARIA_ID,
        datos({ personas: [{ ninoId: NINO_ID }, { ninoId: NINO_2_ID }] }),
        contexto,
      );

      expect(procesosRepository.buscarExpedienteParaAbrir).toHaveBeenCalledWith(
        USUARIA_ID,
        NINO_ID,
      );
      expect(procesosRepository.buscarExpedienteParaAbrir).toHaveBeenCalledWith(
        USUARIA_ID,
        NINO_2_ID,
      );
      expect(procesosRepository.abrirNuevo).toHaveBeenCalledTimes(1);
      expect(respuesta.procesos).toHaveLength(2);
      expect(
        eventosAuditados(auditService).every(
          (e) => e.detalles?.origen === 'FICHA',
        ),
      ).toBe(true);
    });

    it('si una persona de la ficha es ajena, no abre ninguna', async () => {
      procesosRepository.buscarExpedienteParaAbrir.mockImplementation(
        (_usuariaId, ninoId) =>
          Promise.resolve(
            ninoId === NINO_2_ID
              ? 'PERSONA_AJENA'
              : { id: EXPEDIENTE_ID, numero: '05-2026' },
          ),
      );

      await expect(
        service.abrirDesdeFicha(
          USUARIA_ID,
          datos({ personas: [{ ninoId: NINO_ID }, { ninoId: NINO_2_ID }] }),
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(procesosRepository.abrirNuevo).not.toHaveBeenCalled();
    });

    it('revisa el traslape de cada cita y avisa una sola vez, sin repetir citas', async () => {
      const solapada = { id: 'cita-otra' };
      (citasRepository.buscarCitasSolapadas as jest.Mock).mockResolvedValue([
        solapada,
      ]);

      const error: unknown = await service
        .atender(
          REFERIDO_ID,
          datos({ personas: [{ ninoId: null }, { ninoId: NINO_ID }] }),
          contexto,
        )
        .catch((e: unknown) => e);

      expect(citasRepository.buscarCitasSolapadas).toHaveBeenCalledTimes(2);
      expect((error as ConflictException).getResponse()).toMatchObject({
        detalle: { citas: [solapada] },
      });
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
    });

    it('la misma clave con otras personas elegidas no devuelve la respuesta anterior', async () => {
      await service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001');
      await service.atender(
        REFERIDO_ID,
        datos({ personas: [{ ninoId: null }, { ninoId: NINO_ID }] }),
        contexto,
        'clave-0001',
      );

      expect(procesosRepository.abrir).toHaveBeenCalledTimes(2);
    });

    it('dos envíos simultáneos con la misma clave: uno abre y el otro recibe conflicto', async () => {
      let terminar!: () => void;
      procesosRepository.abrir.mockImplementationOnce(
        () =>
          new Promise((resolver) => {
            terminar = () =>
              resolver([
                {
                  procesoId: PROCESO_ID,
                  ninoId: null,
                  consecutivo: 1,
                  ninoConsecutivo: null,
                  citaId: CITA_ID,
                },
              ]);
          }),
      );

      const primera = service.atender(
        REFERIDO_ID,
        datos(),
        contexto,
        'clave-0001',
      );
      await new Promise((r) => setImmediate(r));
      await expect(
        service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001'),
      ).rejects.toBeInstanceOf(ConflictException);
      terminar();
      await primera;

      expect(procesosRepository.abrir).toHaveBeenCalledTimes(1);
      await expect(
        service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001'),
      ).resolves.toMatchObject({ procesos: [{ procesoId: PROCESO_ID }] });
    });

    it('si la escritura falla, la clave queda libre y se puede reintentar', async () => {
      procesosRepository.abrir.mockRejectedValueOnce(new Error('caída'));
      await expect(
        service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001'),
      ).rejects.toThrow('caída');

      await service.atender(REFERIDO_ID, datos(), contexto, 'clave-0001');
      expect(procesosRepository.abrir).toHaveBeenCalledTimes(2);
    });
  });

  describe('atender ahora', () => {
    describe('acceso', () => {
      it('rechaza con 409 el caso que ya tomó alguien, sin abrir ni registrar', async () => {
        bandejaRepository.buscarReferencia.mockResolvedValue(
          referencia({ situacion: 'TOMADA' }),
        );

        await expect(
          service.atenderAhora(REFERIDO_ID, sesionAhora(), contexto),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(procesosRepository.abrirYRegistrar).not.toHaveBeenCalled();
        expect(auditService.registrar).not.toHaveBeenCalled();
      });

      it('rechaza con 409 el caso que otra persona está atendiendo, sin registrar', async () => {
        reservas.exigirSinReservaAjena.mockRejectedValue(RESERVA_AJENA);

        await expect(
          service.atenderAhora(REFERIDO_ID, sesionAhora(), contexto),
        ).rejects.toBe(RESERVA_AJENA);
        expect(procesosRepository.abrirYRegistrar).not.toHaveBeenCalled();
      });

      it('rechaza con 403 una referencia inexistente', async () => {
        bandejaRepository.buscarReferencia.mockResolvedValue(null);

        await expect(
          service.atenderAhora(REFERIDO_ID, sesionAhora(), contexto),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(procesosRepository.abrirYRegistrar).not.toHaveBeenCalled();
      });

      it('rechaza con 400 un hijo/a que no es de este expediente', async () => {
        procesosRepository.ninoPerteneceAExpediente.mockResolvedValue(false);

        await expect(
          service.atenderAhora(
            REFERIDO_ID,
            sesionAhora({ ninoId: NINO_ID }),
            contexto,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(
          procesosRepository.ninoPerteneceAExpediente,
        ).toHaveBeenCalledWith(NINO_ID, EXPEDIENTE_ID);
        expect(procesosRepository.abrirYRegistrar).not.toHaveBeenCalled();
      });

      it('al registrar libera la reserva propia', async () => {
        await service.atenderAhora(REFERIDO_ID, sesionAhora(), contexto);

        expect(reservas.liberar).toHaveBeenCalledWith(
          REFERIDO_ID,
          'psicologa-a',
        );
      });
    });

    it('abre el proceso con la hora del servidor y registra la sesión en un solo paso', async () => {
      await expect(
        service.atenderAhora(REFERIDO_ID, sesionAhora(), contexto),
      ).resolves.toEqual({
        cita: expect.objectContaining({ id: CITA_ID }) as unknown,
        procesoId: PROCESO_ID,
        pasoASeguimiento: true,
        proximaCita: null,
      });
      expect(procesosRepository.abrirYRegistrar).toHaveBeenCalledWith(
        expect.objectContaining({
          expedienteId: EXPEDIENTE_ID,
          referidoId: REFERIDO_ID,
          psicologaId: 'psicologa-a',
          usuariaId: USUARIA_ID,
          persona: { ninoId: null, fechaHora: AHORA, duracionMinutos: 60 },
          registro: expect.objectContaining({
            estado: 'ATENDIDA',
            proximaCita: null,
          }) as unknown,
        }),
      );
      // Nunca se abre un proceso vacío por separado.
      expect(procesosRepository.abrir).not.toHaveBeenCalled();
    });

    it('programa la próxima cita en la misma transacción', async () => {
      await expect(
        service.atenderAhora(
          REFERIDO_ID,
          sesionAhora({ siguiente: PROGRAMAR_PROXIMA }),
          contexto,
        ),
      ).resolves.toMatchObject({
        proximaCita: {
          id: 'cita-proxima',
          procesoId: PROCESO_ID,
          fechaHora: '2026-11-10T15:00:00.000Z',
        },
      });
      expect(procesosRepository.abrirYRegistrar).toHaveBeenCalledWith(
        expect.objectContaining({
          registro: expect.objectContaining({
            proximaCita: expect.objectContaining({
              fechaHora: new Date('2026-11-10T15:00:00.000Z'),
              duracionMinutos: 45,
            }) as unknown,
          }) as unknown,
        }),
      );
    });

    it('audita la toma, la apertura y el registro solo con ids, sin texto clínico', async () => {
      await service.atenderAhora(REFERIDO_ID, sesionAhora(), contexto);

      const eventos = eventosAuditados(auditService);
      expect(eventos.map((evento) => evento.accion)).toEqual([
        'CASO_PSICOLOGIA_TOMADO',
        'PROCESO_PSICOLOGICO_ABIERTO',
        'REGISTRO_CONSULTA_GUARDADO',
      ]);
      expect(eventos[2]).toMatchObject({
        entidad: 'CitaPsicologica',
        entidadId: CITA_ID,
        detalles: {
          sinCita: true,
          atenderAhora: true,
          expedienteId: EXPEDIENTE_ID,
          procesoId: PROCESO_ID,
          pasoASeguimiento: true,
          proximaCitaId: null,
        },
      });
      expect(JSON.stringify(eventos)).not.toContain(TEXTO_CLINICO);
    });

    describe('traslape de la próxima cita', () => {
      beforeEach(() => {
        (citasRepository.buscarCitasSolapadas as jest.Mock).mockResolvedValue([
          { id: 'cita-otra' },
        ]);
      });

      it('no revisa la sesión de ahora: la persona ya está presente', async () => {
        await service.atenderAhora(REFERIDO_ID, sesionAhora(), contexto);

        expect(citasRepository.buscarCitasSolapadas).not.toHaveBeenCalled();
        expect(procesosRepository.abrirYRegistrar).toHaveBeenCalled();
      });

      it('avisa con 409 antes de escribir nada', async () => {
        await expect(
          service.atenderAhora(
            REFERIDO_ID,
            sesionAhora({ siguiente: PROGRAMAR_PROXIMA }),
            contexto,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(citasRepository.buscarCitasSolapadas).toHaveBeenCalledWith(
          expect.objectContaining({ psicologaId: 'psicologa-a' }),
        );
        expect(procesosRepository.abrirYRegistrar).not.toHaveBeenCalled();
        expect(auditService.registrar).not.toHaveBeenCalled();
      });

      it('guarda igual si la psicóloga confirmó el traslape', async () => {
        await service.atenderAhora(
          REFERIDO_ID,
          sesionAhora({
            siguiente: { ...PROGRAMAR_PROXIMA, confirmarTraslape: true },
          }),
          contexto,
        );

        expect(procesosRepository.abrirYRegistrar).toHaveBeenCalled();
      });
    });

    describe('carreras detectadas en la transacción', () => {
      it.each([
        [new ProcesoNoDisponibleError(), ForbiddenException],
        [new CasoYaTomadoError(), ConflictException],
        [new OtroProcesoActivoError(), ConflictException],
      ])('traduce %p', async (error, excepcion) => {
        procesosRepository.abrirYRegistrar.mockRejectedValue(error);

        await expect(
          service.atenderAhora(REFERIDO_ID, sesionAhora(), contexto),
        ).rejects.toBeInstanceOf(excepcion);
        expect(auditService.registrar).not.toHaveBeenCalled();
      });
    });

    describe('idempotencia', () => {
      it('un doble envío con la misma clave registra una sola vez', async () => {
        const primera = await service.atenderAhora(
          REFERIDO_ID,
          sesionAhora(),
          contexto,
          'clave-0001',
        );
        const segunda = await service.atenderAhora(
          REFERIDO_ID,
          sesionAhora(),
          contexto,
          'clave-0001',
        );

        expect(segunda).toEqual(primera);
        expect(procesosRepository.abrirYRegistrar).toHaveBeenCalledTimes(1);
        expect(auditService.registrar).toHaveBeenCalledTimes(3);
      });

      it('un envío simultáneo con la misma clave recibe 409', async () => {
        let soltar: () => void = () => undefined;
        const pendiente = new Promise<void>((resolve) => (soltar = resolve));
        const original =
          procesosRepository.abrirYRegistrar.getMockImplementation();
        procesosRepository.abrirYRegistrar.mockImplementationOnce(
          async (params) => {
            await pendiente;
            return original!(params);
          },
        );

        const primera = service.atenderAhora(
          REFERIDO_ID,
          sesionAhora(),
          contexto,
          'clave-0001',
        );
        await new Promise((resolve) => setImmediate(resolve));
        await expect(
          service.atenderAhora(
            REFERIDO_ID,
            sesionAhora(),
            contexto,
            'clave-0001',
          ),
        ).rejects.toBeInstanceOf(ConflictException);
        soltar();
        await primera;
        expect(procesosRepository.abrirYRegistrar).toHaveBeenCalledTimes(1);
      });

      it('tras un fallo, el reintento con la misma clave sí se guarda', async () => {
        procesosRepository.abrirYRegistrar.mockRejectedValueOnce(
          new Error('caída'),
        );
        await expect(
          service.atenderAhora(
            REFERIDO_ID,
            sesionAhora(),
            contexto,
            'clave-0001',
          ),
        ).rejects.toThrow('caída');

        await expect(
          service.atenderAhora(
            REFERIDO_ID,
            sesionAhora(),
            contexto,
            'clave-0001',
          ),
        ).resolves.toMatchObject({ procesoId: PROCESO_ID });
        expect(procesosRepository.abrirYRegistrar).toHaveBeenCalledTimes(2);
      });

      it('la clave queda atada a la psicóloga, la referencia y la persona', async () => {
        await service.atenderAhora(
          REFERIDO_ID,
          sesionAhora({ ninoId: NINO_ID }),
          contexto,
          'clave-0001',
        );

        expect([...redis.datos.keys()]).toEqual([
          `psicologia:atender-ahora:${REFERIDO_ID}:${NINO_ID}:psicologa-a:clave-0001`,
        ]);
      });
    });

    it('el schema solo acepta una sesión atendida', () => {
      expect(() => sesionAhora({ estado: 'NO_ASISTIO' })).toThrow();
    });
  });

  describe('schema', () => {
    it('rechaza una apertura sin personas', () => {
      expect(
        abrirProcesosPsicologiaSchema.safeParse({ personas: [] }).success,
      ).toBe(false);
    });

    it('rechaza a la misma persona dos veces', () => {
      expect(
        abrirProcesosPsicologiaSchema.safeParse({
          personas: [
            { ninoId: NINO_ID, fechaHora: '2026-10-07T09:00' },
            { ninoId: NINO_ID, fechaHora: '2026-10-07T10:00' },
          ],
        }).success,
      ).toBe(false);
    });
  });
});
