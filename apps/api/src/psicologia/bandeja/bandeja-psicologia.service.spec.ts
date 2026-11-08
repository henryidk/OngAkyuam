/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  contexto,
  crearAcceso,
  crearAtencionRepository,
  crearAuditService,
  crearBandejaRepository,
  crearProcesosRepository,
  eventosAuditados,
  EXPEDIENTE_ID,
  PROCESO_ID,
  referencia,
  REFERIDO_ID,
} from '../pruebas/dobles';
import { BandejaPsicologiaService } from './bandeja-psicologia.service';

describe('BandejaPsicologiaService', () => {
  const bandejaRepository = crearBandejaRepository();
  const atencionRepository = crearAtencionRepository();
  const auditService = crearAuditService();
  const service = new BandejaPsicologiaService(
    bandejaRepository,
    atencionRepository,
    crearAcceso(bandejaRepository, crearProcesosRepository()),
    auditService,
  );

  const sinTomar = referencia({ situacion: 'SIN_TOMAR', procesoId: null });

  beforeEach(() => {
    jest.clearAllMocks();
    // Antes de tomar nadie es dueña; después, la referencia ya es de quien la tomó.
    bandejaRepository.buscarReferencia
      .mockReset()
      .mockResolvedValueOnce(sinTomar)
      .mockResolvedValue(referencia());
    (atencionRepository.tomarCaso as jest.Mock).mockResolvedValue('TOMADO');
  });

  it('"por agendar" siempre se pide con la psicóloga autenticada', async () => {
    await service.listarPorAgendar('psicologa-a');

    expect(bandejaRepository.listarPorAgendar).toHaveBeenCalledWith(
      'psicologa-a',
    );
  });

  describe('tomar', () => {
    it('asigna el caso a quien lo toma y devuelve su proceso', async () => {
      await expect(service.tomar(REFERIDO_ID, contexto)).resolves.toEqual({
        referidoId: REFERIDO_ID,
        procesoId: PROCESO_ID,
      });
      expect(atencionRepository.tomarCaso).toHaveBeenCalledWith({
        expedienteId: EXPEDIENTE_ID,
        psicologaId: 'psicologa-a',
      });
    });

    it('audita solo ids', async () => {
      await service.tomar(REFERIDO_ID, contexto);

      expect(eventosAuditados(auditService)).toEqual([
        expect.objectContaining({
          accion: 'CASO_PSICOLOGIA_TOMADO',
          entidadId: PROCESO_ID,
          detalles: { expedienteId: EXPEDIENTE_ID, referidoId: REFERIDO_ID },
        }),
      ]);
    });

    it('rechaza con 403 una referencia inexistente o de otra área, sin tocar nada', async () => {
      bandejaRepository.buscarReferencia.mockReset().mockResolvedValue(null);

      await expect(service.tomar(REFERIDO_ID, contexto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(atencionRepository.tomarCaso).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it.each(['MIA', 'NO_DISPONIBLE'] as const)(
      'responde 409 si la referencia ya está %s',
      async (situacion) => {
        bandejaRepository.buscarReferencia
          .mockReset()
          .mockResolvedValue(referencia({ situacion }));

        await expect(
          service.tomar(REFERIDO_ID, contexto),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(atencionRepository.tomarCaso).not.toHaveBeenCalled();
      },
    );

    it('responde 409 y no audita cuando otra psicóloga ganó la carrera', async () => {
      (atencionRepository.tomarCaso as jest.Mock).mockResolvedValue(
        'YA_TOMADO',
      );

      await expect(service.tomar(REFERIDO_ID, contexto)).rejects.toEqual(
        new ConflictException('Este caso ya fue tomado por otra profesional'),
      );
      expect(auditService.registrar).not.toHaveBeenCalled();
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
      bandejaRepository.buscarReferencia
        .mockReset()
        .mockResolvedValue(sinTomar);
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

    it('rechaza con 403 el caso que ya tomó otra psicóloga, sin consultar nada', async () => {
      bandejaRepository.buscarReferencia
        .mockReset()
        .mockResolvedValue(
          referencia({ situacion: 'NO_DISPONIBLE', procesoId: null }),
        );

      await expect(
        service.obtenerPreviaToma(REFERIDO_ID, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bandejaRepository.obtenerPreviaToma).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('obtenerPorAgendar', () => {
    // Datos ficticios.
    const caso = {
      referidoId: REFERIDO_ID,
      expedienteId: EXPEDIENTE_ID,
      expedienteNumero: '05-2026',
      usuariaId: 'usuaria-ficticia',
      usuariaNombreCompleto: 'Usuaria Ficticia',
      tomadaEn: '2026-11-01T15:00:00.000Z',
      personas: [],
    };

    beforeEach(() => {
      bandejaRepository.buscarReferencia
        .mockReset()
        .mockResolvedValue(referencia());
      bandejaRepository.buscarPorAgendar.mockReset().mockResolvedValue(caso);
    });

    it('devuelve el caso tomado, buscado con la psicóloga autenticada', async () => {
      await expect(
        service.obtenerPorAgendar(REFERIDO_ID, 'psicologa-a'),
      ).resolves.toEqual(caso);
      expect(bandejaRepository.buscarPorAgendar).toHaveBeenCalledWith(
        'psicologa-a',
        REFERIDO_ID,
      );
    });

    it.each([
      ['inexistente', null],
      [
        'de otra psicóloga',
        referencia({ situacion: 'NO_DISPONIBLE', procesoId: null }),
      ],
    ])(
      'rechaza con 403 un caso %s, sin consultar nada',
      async (_, encontrada) => {
        bandejaRepository.buscarReferencia
          .mockReset()
          .mockResolvedValue(encontrada);

        await expect(
          service.obtenerPorAgendar(REFERIDO_ID, 'psicologa-a'),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(bandejaRepository.buscarPorAgendar).not.toHaveBeenCalled();
      },
    );

    it('exige tomar el caso antes (409)', async () => {
      bandejaRepository.buscarReferencia
        .mockReset()
        .mockResolvedValue(sinTomar);

      await expect(
        service.obtenerPorAgendar(REFERIDO_ID, 'psicologa-a'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(bandejaRepository.buscarPorAgendar).not.toHaveBeenCalled();
    });

    it('avisa con 409 si el caso ya tiene su primera cita', async () => {
      bandejaRepository.buscarPorAgendar.mockResolvedValue(null);

      await expect(
        service.obtenerPorAgendar(REFERIDO_ID, 'psicologa-a'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('tomarPorReasignar', () => {
    const reasignado = {
      procesoId: PROCESO_ID,
      expedienteId: EXPEDIENTE_ID,
      psicologaAnteriorId: 'psicologa-inactiva',
      referidoIdPorAgendar: null,
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
        referidoIdPorAgendar: null,
        citasCanceladas: 2,
      });
      expect(bandejaRepository.reasignar).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        psicologaId: 'psicologa-a',
      });
    });

    it('devuelve la referencia cuando el caso aún no tenía primera cita', async () => {
      bandejaRepository.reasignar.mockResolvedValue({
        ...reasignado,
        referidoIdPorAgendar: REFERIDO_ID,
        citasCanceladas: 0,
      });

      await expect(
        service.tomarPorReasignar(PROCESO_ID, contexto),
      ).resolves.toMatchObject({ referidoIdPorAgendar: REFERIDO_ID });
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
