/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { AccesoPsicologiaService } from './acceso-psicologia.service';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';

describe('AccesoPsicologiaService', () => {
  let service: AccesoPsicologiaService;
  let atencionRepository: jest.Mocked<IAtencionPsicologicaRepository>;
  let citasRepository: jest.Mocked<ICitasPsicologicasRepository>;

  beforeEach(() => {
    atencionRepository = {
      buscarExpedienteConAcceso: jest.fn(),
      obtenerOCrear: jest.fn(),
      actualizarEstado: jest.fn(),
      existeReferidoPsicologia: jest.fn(),
      tomarCaso: jest.fn(),
      listarReferenciasSinTomar: jest.fn(),
    };
    citasRepository = {
      buscarAccesoCita: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      listarAgenda: jest.fn(),
      buscarCitasSolapadas: jest.fn(),
      obtenerDatosParaReprogramar: jest.fn(),
      reprogramar: jest.fn(),
      registrarConsulta: jest.fn(),
    };
    service = new AccesoPsicologiaService(atencionRepository, citasRepository);
  });

  describe('exigirAccesoExpediente', () => {
    // Los tres motivos por los que el repositorio devuelve null deben dar exactamente el mismo
    // 403 — es la garantía anti-enumeración central de §7.4 del plan.
    const escenarios: Array<[string]> = [
      ['expediente inexistente'],
      ['expediente existente pero no referido a PSICOLOGIA'],
      ['expediente referido pero tomado por otra psicóloga'],
    ];

    it.each(escenarios)('rechaza con 403 genérico cuando: %s', async () => {
      atencionRepository.buscarExpedienteConAcceso.mockResolvedValue(null);

      await expect(
        service.exigirAccesoExpediente('exp-1', 'psicologa-b'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('pasa el id de la psicóloga autenticada al repositorio, nunca solo el expedienteId', async () => {
      atencionRepository.buscarExpedienteConAcceso.mockResolvedValue({
        id: 'exp-1',
      });

      await service.exigirAccesoExpediente('exp-1', 'psicologa-a');

      expect(atencionRepository.buscarExpedienteConAcceso).toHaveBeenCalledWith(
        'exp-1',
        'psicologa-a',
      );
    });

    it('permite el acceso cuando el repositorio confirma la dueña', async () => {
      atencionRepository.buscarExpedienteConAcceso.mockResolvedValue({
        id: 'exp-1',
      });

      await expect(
        service.exigirAccesoExpediente('exp-1', 'psicologa-a'),
      ).resolves.toBeUndefined();
    });
  });

  describe('exigirAccesoCita', () => {
    it('rechaza con 403 si la cita no pertenece a un caso tomado por esta psicóloga', async () => {
      citasRepository.buscarAccesoCita.mockResolvedValue(null);

      await expect(
        service.exigirAccesoCita('cita-1', 'psicologa-b'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('devuelve el acceso resuelto cuando la cita sí pertenece a esta psicóloga', async () => {
      const acceso = {
        id: 'cita-1',
        atencionId: 'atencion-1',
        expedienteId: 'exp-1',
      };
      citasRepository.buscarAccesoCita.mockResolvedValue(acceso);

      await expect(
        service.exigirAccesoCita('cita-1', 'psicologa-a'),
      ).resolves.toEqual(acceso);
      expect(citasRepository.buscarAccesoCita).toHaveBeenCalledWith(
        'cita-1',
        'psicologa-a',
      );
    });
  });

  describe('exigirReferidoPsicologia', () => {
    it('rechaza con el mismo 403 genérico si no hay referido a PSICOLOGIA', async () => {
      atencionRepository.existeReferidoPsicologia.mockResolvedValue(false);

      await expect(
        service.exigirReferidoPsicologia('exp-ajeno'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('permite continuar cuando el referido existe, sin importar si ya fue tomado', async () => {
      atencionRepository.existeReferidoPsicologia.mockResolvedValue(true);

      await expect(
        service.exigirReferidoPsicologia('exp-1'),
      ).resolves.toBeUndefined();
    });
  });
});
