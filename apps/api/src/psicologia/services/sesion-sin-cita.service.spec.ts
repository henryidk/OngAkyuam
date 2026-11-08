/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { sesionSinCitaSchema, type SesionSinCitaInput } from '@akyuam/shared';
import type { AuditService } from '../../auth/services/audit.service';
import type { IReloj } from '../../common/reloj';
import { IdempotenciaPsicologia } from '../compartido/idempotencia';
import { MENSAJE_SIN_ACCESO_PROCESO } from '../compartido/mensajes';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import type { AccesoProcesoPsicologia } from '../interfaces/procesos-psicologia-repository.interface';
import {
  crearAuditService,
  crearRedis,
  eventosAuditados,
} from '../pruebas/dobles';
import type { AccesoPsicologiaService } from './acceso-psicologia.service';
import { SesionSinCitaService } from './sesion-sin-cita.service';

// El servicio real abre una conexión: aquí basta el doble en memoria.
jest.mock('../../redis/redis.service', () => ({ RedisService: class {} }));

const AHORA = new Date('2026-11-08T16:20:00.000Z');
const PROCESO_ID = '11111111-1111-4111-8111-111111111111';

const contexto = {
  usuarioId: 'psicologa-a',
  username: 'psicologa.a',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

const procesoAbierto: AccesoProcesoPsicologia = {
  id: PROCESO_ID,
  expedienteId: 'exp-1',
  expedienteNumero: 'EXP-1',
  usuariaId: 'usuaria-1',
  consecutivo: 1,
  etapa: 'SEGUIMIENTO',
  version: 1,
  ninoId: null,
};

function datos(
  registro: Partial<SesionSinCitaInput['registro']> = {},
): SesionSinCitaInput {
  return {
    duracionMinutos: 45,
    registro: {
      estado: 'ATENDIDA',
      temas: 'Texto clínico que no debe auditarse',
      intervencion: '',
      diagnostico: 'Diagnóstico',
      acuerdos: '',
      observaciones: '',
      motivoNoAsistencia: '',
      clinica: 'CLINICA_1',
      enfoqueTerapeutico: '',
      atencionBrindada: 'Contención',
      ...registro,
    },
  };
}

describe('SesionSinCitaService', () => {
  let service: SesionSinCitaService;
  let acceso: jest.Mocked<Pick<AccesoPsicologiaService, 'exigirAccesoProceso'>>;
  let citasRepository: jest.Mocked<ICitasPsicologicasRepository>;
  let auditService: AuditService;
  let redis: ReturnType<typeof crearRedis>;

  beforeEach(() => {
    acceso = {
      exigirAccesoProceso: jest.fn().mockResolvedValue(procesoAbierto),
    };
    citasRepository = {
      buscarCitasSolapadas: jest.fn().mockResolvedValue([]),
      registrarSesionSinCita: jest.fn().mockResolvedValue({
        cita: { id: 'cita-nueva' },
        pasoASeguimiento: false,
        proximaCitaId: null,
      }),
    } as unknown as jest.Mocked<ICitasPsicologicasRepository>;
    auditService = crearAuditService();
    redis = crearRedis();
    const reloj: IReloj = { ahora: () => AHORA };
    service = new SesionSinCitaService(
      acceso as unknown as AccesoPsicologiaService,
      citasRepository,
      auditService,
      new IdempotenciaPsicologia(redis),
      reloj,
    );
  });

  describe('autorización', () => {
    it('la responsable del proceso abierto registra la sesión con la hora del servidor', async () => {
      const respuesta = await service.registrar(PROCESO_ID, datos(), contexto);

      expect(acceso.exigirAccesoProceso).toHaveBeenCalledWith(
        PROCESO_ID,
        'psicologa-a',
      );
      expect(citasRepository.registrarSesionSinCita).toHaveBeenCalledWith(
        expect.objectContaining({
          procesoId: PROCESO_ID,
          psicologaId: 'psicologa-a',
          fechaHora: AHORA,
          duracionMinutos: 45,
          estado: 'ATENDIDA',
          intervencion: null,
          proximaCita: null,
        }),
      );
      expect(respuesta.cita.id).toBe('cita-nueva');
      expect(respuesta.procesoId).toBe(PROCESO_ID);
    });

    it('un proceso ajeno da 403 y no escribe ni audita nada', async () => {
      acceso.exigirAccesoProceso.mockRejectedValue(
        new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO),
      );

      await expect(
        service.registrar(PROCESO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(citasRepository.registrarSesionSinCita).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('un reintento de quien ya no tiene acceso no recibe la respuesta guardada', async () => {
      await service.registrar(PROCESO_ID, datos(), contexto, 'clave-0001');
      acceso.exigirAccesoProceso.mockRejectedValue(
        new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO),
      );

      await expect(
        service.registrar(PROCESO_ID, datos(), contexto, 'clave-0001'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un proceso cerrado da conflicto y no escribe nada', async () => {
      acceso.exigirAccesoProceso.mockResolvedValue({
        ...procesoAbierto,
        etapa: 'CIERRE',
      });

      await expect(
        service.registrar(PROCESO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(citasRepository.registrarSesionSinCita).not.toHaveBeenCalled();
    });

    it('si el proceso se cerró durante la transacción, da conflicto y no audita', async () => {
      citasRepository.registrarSesionSinCita.mockResolvedValue(null);

      await expect(
        service.registrar(PROCESO_ID, datos(), contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  it('un doble envío con la misma Idempotency-Key crea una sola sesión', async () => {
    const primera = await service.registrar(
      PROCESO_ID,
      datos(),
      contexto,
      'clave-0001',
    );
    const segunda = await service.registrar(
      PROCESO_ID,
      datos(),
      contexto,
      'clave-0001',
    );

    expect(segunda).toEqual(primera);
    expect(citasRepository.registrarSesionSinCita).toHaveBeenCalledTimes(1);
  });

  it('dos envíos simultáneos con la misma clave: uno escribe y el otro recibe conflicto', async () => {
    let terminar!: () => void;
    citasRepository.registrarSesionSinCita.mockImplementationOnce(
      () =>
        new Promise((resolver) => {
          terminar = () =>
            resolver({
              cita: { id: 'cita-nueva' },
              pasoASeguimiento: false,
              proximaCitaId: null,
            });
        }),
    );

    const primera = service.registrar(
      PROCESO_ID,
      datos(),
      contexto,
      'clave-0001',
    );
    await new Promise((r) => setImmediate(r));
    await expect(
      service.registrar(PROCESO_ID, datos(), contexto, 'clave-0001'),
    ).rejects.toBeInstanceOf(ConflictException);
    terminar();
    await primera;

    expect(citasRepository.registrarSesionSinCita).toHaveBeenCalledTimes(1);
    // Al terminar libera la reserva: el reintento recibe la respuesta guardada.
    await expect(
      service.registrar(PROCESO_ID, datos(), contexto, 'clave-0001'),
    ).resolves.toMatchObject({ cita: { id: 'cita-nueva' } });
  });

  it('si la escritura falla, libera la reserva y se puede reintentar', async () => {
    citasRepository.registrarSesionSinCita.mockRejectedValueOnce(
      new Error('caída'),
    );
    await expect(
      service.registrar(PROCESO_ID, datos(), contexto, 'clave-0001'),
    ).rejects.toThrow('caída');

    await service.registrar(PROCESO_ID, datos(), contexto, 'clave-0001');
    expect(citasRepository.registrarSesionSinCita).toHaveBeenCalledTimes(2);
  });

  it('avisa el traslape de la próxima cita antes de escribir', async () => {
    citasRepository.buscarCitasSolapadas.mockResolvedValue([
      { id: 'otra' } as never,
    ]);

    await expect(
      service.registrar(
        PROCESO_ID,
        datos({
          siguiente: {
            tipo: 'PROGRAMAR',
            fechaHora: '2026-11-15T10:00',
            duracionMinutos: 45,
          },
        }),
        contexto,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(citasRepository.registrarSesionSinCita).not.toHaveBeenCalled();
  });

  it('audita el registro sin texto clínico', async () => {
    await service.registrar(PROCESO_ID, datos(), contexto);

    const [evento] = eventosAuditados(auditService);
    expect(evento.accion).toBe('REGISTRO_CONSULTA_GUARDADO');
    expect(evento.entidadId).toBe('cita-nueva');
    expect(evento.detalles).toMatchObject({
      sinCita: true,
      procesoId: PROCESO_ID,
    });
    expect(JSON.stringify(evento.detalles)).not.toContain('Texto clínico');
    expect(JSON.stringify(evento.detalles)).not.toContain('Contención');
  });

  describe('schema', () => {
    it('rechaza una sesión sin cita que no quedó atendida', () => {
      const resultado = sesionSinCitaSchema.safeParse(
        datos({ estado: 'NO_ASISTIO', motivoNoAsistencia: 'No vino' }),
      );
      expect(resultado.success).toBe(false);
    });

    it('acepta una sesión atendida', () => {
      expect(sesionSinCitaSchema.safeParse(datos()).success).toBe(true);
    });
  });
});
