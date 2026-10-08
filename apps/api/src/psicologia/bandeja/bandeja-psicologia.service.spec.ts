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
});
