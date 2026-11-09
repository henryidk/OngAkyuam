/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  contexto,
  crearAcceso,
  crearAuditService,
  crearBandejaRepository,
  crearProcesosRepository,
  crearReservas,
  eventosAuditados,
  EXPEDIENTE_ID,
  PROCESO_ID,
  referencia,
  REFERIDO_ID,
} from '../pruebas/dobles';
import { BandejaPsicologiaService } from './bandeja-psicologia.service';

// La reserva real necesita Redis: aquí se usa el doble y se evita cargar su configuración.
jest.mock('../../redis/redis.service', () => ({ RedisService: class {} }));

describe('BandejaPsicologiaService', () => {
  const bandejaRepository = crearBandejaRepository();
  const reservas = crearReservas();
  const auditService = crearAuditService();
  const service = new BandejaPsicologiaService(
    bandejaRepository,
    crearAcceso(bandejaRepository, crearProcesosRepository()),
    reservas,
    auditService,
  );
  const personal = { id: 'psicologa-a', nombreCompleto: 'Psicóloga Ficticia' };
  const tomada = referencia({ situacion: 'TOMADA' });

  beforeEach(() => {
    jest.clearAllMocks();
    bandejaRepository.buscarReferencia
      .mockReset()
      .mockResolvedValue(referencia());
  });

  it('cada tarjeta del Área de atención lleva su reserva, vista por quien pregunta', async () => {
    const reserva = {
      nombre: 'Psicóloga Ficticia',
      desde: '2026-11-09T16:15:00.000Z',
      motivo: 'AGENDANDO' as const,
      propia: false,
    };
    bandejaRepository.listarSinTomar.mockResolvedValue([
      { referidoId: 'ref-1' },
      { referidoId: 'ref-2' },
    ] as Awaited<ReturnType<typeof bandejaRepository.listarSinTomar>>);
    reservas.vigentes.mockResolvedValue([reserva, null]);

    await expect(service.listarSinTomar('psicologa-b')).resolves.toEqual([
      { referidoId: 'ref-1', reserva },
      { referidoId: 'ref-2', reserva: null },
    ]);
    expect(reservas.vigentes).toHaveBeenCalledWith(
      ['ref-1', 'ref-2'],
      'psicologa-b',
    );
  });

  describe('reservar', () => {
    it('reserva a nombre de quien llama, sin tomar el caso ni auditar', async () => {
      await service.reservar(REFERIDO_ID, 'AGENDANDO', personal);

      expect(reservas.reservar).toHaveBeenCalledWith(
        REFERIDO_ID,
        personal,
        'AGENDANDO',
      );
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('rechaza con 403 una referencia inexistente o de otra área, sin reservar', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(null);

      await expect(
        service.reservar(REFERIDO_ID, 'AGENDANDO', personal),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(reservas.reservar).not.toHaveBeenCalled();
    });

    it('rechaza con 409 un caso que ya tomó alguien, sin reservar', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(tomada);

      await expect(
        service.reservar(REFERIDO_ID, 'ATENDIENDO', personal),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(reservas.reservar).not.toHaveBeenCalled();
    });

    it('propaga el 409 cuando otra persona tiene la reserva', async () => {
      reservas.reservar.mockRejectedValueOnce(new ConflictException());

      await expect(
        service.reservar(REFERIDO_ID, 'AGENDANDO', personal),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  it('libera solo la reserva de quien llama', async () => {
    await service.liberar(REFERIDO_ID, 'psicologa-a');

    expect(reservas.liberar).toHaveBeenCalledWith(REFERIDO_ID, 'psicologa-a');
  });

  describe('obtenerParaAgendar', () => {
    // Datos ficticios.
    const paraAgendar = {
      referidoId: REFERIDO_ID,
      expedienteId: EXPEDIENTE_ID,
      expedienteNumero: '05-2026',
      usuariaId: 'usuaria-ficticia',
      usuariaNombreCompleto: 'Usuaria Ficticia',
      personas: [],
    };

    it('devuelve a quién se le puede agendar la primera cita', async () => {
      bandejaRepository.buscarParaAgendar.mockResolvedValue(paraAgendar);

      await expect(service.obtenerParaAgendar(REFERIDO_ID)).resolves.toEqual(
        paraAgendar,
      );
    });

    it.each([
      ['inexistente (403)', null, ForbiddenException],
      ['ya tomada (409)', tomada, ConflictException],
    ])(
      'rechaza una referencia %s sin consultar nada',
      async (_, encontrada, error) => {
        bandejaRepository.buscarReferencia.mockResolvedValue(encontrada);

        await expect(
          service.obtenerParaAgendar(REFERIDO_ID),
        ).rejects.toBeInstanceOf(error);
        expect(bandejaRepository.buscarParaAgendar).not.toHaveBeenCalled();
      },
    );

    it('responde 409 si entre una consulta y otra alguien la tomó', async () => {
      bandejaRepository.buscarParaAgendar.mockResolvedValue(null);

      await expect(
        service.obtenerParaAgendar(REFERIDO_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('obtenerPreviaToma', () => {
    // Datos ficticios.
    const previa = {
      referidoId: REFERIDO_ID,
      expedienteNumero: '05-2026',
      usuariaNombreCompleto: 'Usuaria Ficticia',
      edad: 30,
      municipio: 'Cobán',
      grupoEtnico: 'Maya',
      tipologias: ['Violencia física'],
      motivo: 'Motivo ficticio',
      referidoEn: '2026-10-01T15:00:00.000Z',
      referidoPor: 'Trabajadora Social Ficticia',
      personas: [],
    };

    beforeEach(() => {
      bandejaRepository.obtenerPreviaToma.mockResolvedValue(previa);
    });

    it('devuelve la vista previa de una referencia sin tomar y audita solo ids', async () => {
      await expect(
        service.obtenerPreviaToma(REFERIDO_ID, contexto),
      ).resolves.toEqual(previa);
      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'EXPEDIENTE_PREVIA_CONSULTADA',
          entidadId: EXPEDIENTE_ID,
          detalles: { referidoId: REFERIDO_ID },
        }),
      ]);
    });

    it('rechaza con 403 una referencia inexistente o de otra área, sin consultar nada', async () => {
      bandejaRepository.buscarReferencia.mockReset().mockResolvedValue(null);

      await expect(
        service.obtenerPreviaToma(REFERIDO_ID, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bandejaRepository.obtenerPreviaToma).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('rechaza con 403 el caso que ya tomó alguien, sin consultar nada', async () => {
      bandejaRepository.buscarReferencia.mockReset().mockResolvedValue(tomada);

      await expect(
        service.obtenerPreviaToma(REFERIDO_ID, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bandejaRepository.obtenerPreviaToma).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('tomarPorReasignar', () => {
    const reasignado = {
      procesoId: PROCESO_ID,
      expedienteId: EXPEDIENTE_ID,
      psicologaAnteriorId: 'psicologa-inactiva',
      citasCanceladas: 2,
    };

    it('la lista es la del área: no depende de quién pregunta', async () => {
      await service.listarPorReasignar();

      expect(bandejaRepository.listarPorReasignar).toHaveBeenCalledWith();
    });

    it('pasa el proceso a quien lo toma, nunca a otra persona', async () => {
      bandejaRepository.reasignar.mockResolvedValue(reasignado);

      await expect(
        service.tomarPorReasignar(PROCESO_ID, contexto),
      ).resolves.toEqual({
        procesoId: PROCESO_ID,
        citasCanceladas: 2,
      });
      expect(bandejaRepository.reasignar).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        psicologaId: 'psicologa-a',
      });
    });

    it('audita solo ids: quién lo llevaba y cuántas citas se cancelaron', async () => {
      bandejaRepository.reasignar.mockResolvedValue(reasignado);

      await service.tomarPorReasignar(PROCESO_ID, contexto);

      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'PROCESO_PSICOLOGIA_REASIGNADO',
          entidadId: PROCESO_ID,
          detalles: {
            expedienteId: EXPEDIENTE_ID,
            psicologaAnteriorId: 'psicologa-inactiva',
            citasCanceladas: 2,
          },
        }),
      ]);
    });

    it('responde 409 y no audita si el proceso no está por reasignar o ya lo tomó otra', async () => {
      bandejaRepository.reasignar.mockResolvedValue(null);

      await expect(
        service.tomarPorReasignar(PROCESO_ID, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });
});
