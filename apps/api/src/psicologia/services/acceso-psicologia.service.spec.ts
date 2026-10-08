/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type {
  IBandejaPsicologiaRepository,
  ReferenciaPsicologia,
} from '../interfaces/bandeja-psicologia-repository.interface';
import type { IProcesosPsicologiaRepository } from '../interfaces/procesos-psicologia-repository.interface';
import { AccesoPsicologiaService } from './acceso-psicologia.service';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';

describe('AccesoPsicologiaService', () => {
  let service: AccesoPsicologiaService;
  let atencionRepository: jest.Mocked<IAtencionPsicologicaRepository>;
  let citasRepository: jest.Mocked<ICitasPsicologicasRepository>;
  let bandejaRepository: jest.Mocked<IBandejaPsicologiaRepository>;
  let procesosRepository: jest.Mocked<IProcesosPsicologiaRepository>;

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
      buscarLecturaCita: jest.fn(),
      crear: jest.fn(),
      actualizar: jest.fn(),
      listarAgenda: jest.fn(),
      buscarCitasSolapadas: jest.fn(),
      obtenerDatosParaReprogramar: jest.fn(),
      reprogramar: jest.fn(),
      registrarConsulta: jest.fn(),
    };
    bandejaRepository = {
      listarSinTomar: jest.fn(),
      listarPorAgendar: jest.fn(),
      buscarReferencia: jest.fn(),
    };
    procesosRepository = {
      buscarAccesoProceso: jest.fn(),
      buscarLecturaProceso: jest.fn(),
      buscarAccesoUsuaria: jest.fn(),
      ninoPerteneceAExpediente: jest.fn(),
      abrir: jest.fn(),
      abrirNuevo: jest.fn(),
      cerrar: jest.fn(),
      actualizarVisibilidad: jest.fn(),
    };
    service = new AccesoPsicologiaService(
      atencionRepository,
      citasRepository,
      bandejaRepository,
      procesosRepository,
    );
  });

  describe('exigirAccesoProceso', () => {
    it.each([['proceso inexistente'], ['proceso de otra psicóloga']])(
      'rechaza con el mismo 403 cuando: %s',
      async () => {
        procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

        await expect(
          service.exigirAccesoProceso('proc-1', 'psicologa-b'),
        ).rejects.toEqual(
          new ForbiddenException('No tiene acceso a este proceso'),
        );
      },
    );

    it('consulta siempre con el id de la psicóloga autenticada', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue({
        id: 'proc-1',
        expedienteId: 'exp-1',
        expedienteNumero: '05-2026',
        usuariaId: 'usuaria-1',
        consecutivo: 1,
        etapa: 'INICIO',
        version: 1,
      });

      await service.exigirAccesoProceso('proc-1', 'psicologa-a');

      expect(procesosRepository.buscarAccesoProceso).toHaveBeenCalledWith(
        'proc-1',
        'psicologa-a',
      );
    });
  });

  describe('exigirLecturaProceso', () => {
    it.each([
      ['proceso inexistente'],
      ['proceso abierto de otra psicóloga'],
      ['proceso cerrado de una usuaria con la que no tiene ningún caso'],
    ])('rechaza con el mismo 403 cuando: %s', async () => {
      procesosRepository.buscarLecturaProceso.mockResolvedValue(null);

      await expect(
        service.exigirLecturaProceso('proc-1', 'psicologa-b'),
      ).rejects.toEqual(
        new ForbiddenException('No tiene acceso a este proceso'),
      );
    });

    it('deja leer el proceso cerrado de una colega y avisa que no es propio', async () => {
      const lectura = { id: 'proc-1', expedienteId: 'exp-1', propio: false };
      procesosRepository.buscarLecturaProceso.mockResolvedValue(lectura);

      await expect(
        service.exigirLecturaProceso('proc-1', 'psicologa-a'),
      ).resolves.toEqual(lectura);
      expect(procesosRepository.buscarLecturaProceso).toHaveBeenCalledWith(
        'proc-1',
        'psicologa-a',
      );
    });

    it('poder leer un proceso ajeno no da el acceso de dueña', async () => {
      procesosRepository.buscarLecturaProceso.mockResolvedValue({
        id: 'proc-1',
        expedienteId: 'exp-1',
        propio: false,
      });
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

      await expect(
        service.exigirAccesoProceso('proc-1', 'psicologa-a'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(procesosRepository.buscarLecturaProceso).not.toHaveBeenCalled();
    });
  });

  describe('exigirAccesoUsuaria', () => {
    it('rechaza con 403 a la usuaria inexistente o que solo atiende otra psicóloga', async () => {
      procesosRepository.buscarAccesoUsuaria.mockResolvedValue(null);

      await expect(
        service.exigirAccesoUsuaria('usuaria-ajena', 'psicologa-a'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(procesosRepository.buscarAccesoUsuaria).toHaveBeenCalledWith(
        'usuaria-ajena',
        'psicologa-a',
      );
    });

    it('devuelve el acceso cuando la psicóloga puede verla', async () => {
      const acceso = {
        usuariaId: 'usuaria-1',
        expediente: { id: 'exp-1', numero: '05-2026' },
      };
      procesosRepository.buscarAccesoUsuaria.mockResolvedValue(acceso);

      await expect(
        service.exigirAccesoUsuaria('usuaria-1', 'psicologa-a'),
      ).resolves.toEqual(acceso);
    });
  });

  describe('exigirCasoTomado', () => {
    const referencia: ReferenciaPsicologia = {
      referidoId: 'ref-1',
      expedienteId: 'exp-1',
      expedienteNumero: '05-2026',
      usuariaId: 'usuaria-1',
      situacion: 'MIA',
      procesoId: 'proc-1',
    };

    it('rechaza con 403 una referencia que no existe o no es de Psicología', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(null);

      await expect(
        service.exigirCasoTomado('ref-1', 'psicologa-a'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rechaza con 403 el caso que tomó otra psicóloga', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue({
        ...referencia,
        situacion: 'NO_DISPONIBLE',
        procesoId: null,
      });

      await expect(
        service.exigirCasoTomado('ref-1', 'psicologa-b'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('pide tomar el caso primero (409) si nadie lo ha tomado', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue({
        ...referencia,
        situacion: 'SIN_TOMAR',
        procesoId: null,
      });

      await expect(
        service.exigirCasoTomado('ref-1', 'psicologa-a'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('devuelve el caso con su proceso cuando es de quien pregunta', async () => {
      bandejaRepository.buscarReferencia.mockResolvedValue(referencia);

      await expect(
        service.exigirCasoTomado('ref-1', 'psicologa-a'),
      ).resolves.toMatchObject({ procesoId: 'proc-1', expedienteId: 'exp-1' });
      expect(bandejaRepository.buscarReferencia).toHaveBeenCalledWith(
        'ref-1',
        'psicologa-a',
      );
    });
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

  describe('exigirLecturaCita', () => {
    it('rechaza con 403 la cita de un proceso que no puede leer', async () => {
      citasRepository.buscarLecturaCita.mockResolvedValue(null);

      await expect(
        service.exigirLecturaCita('cita-1', 'psicologa-b'),
      ).rejects.toEqual(new ForbiddenException('No tiene acceso a esta cita'));
    });

    it('deja leer la cita del proceso cerrado de una colega, sin dar acceso de dueña', async () => {
      const lectura = {
        id: 'cita-1',
        atencionId: 'atencion-1',
        expedienteId: 'exp-1',
        propia: false,
      };
      citasRepository.buscarLecturaCita.mockResolvedValue(lectura);
      citasRepository.buscarAccesoCita.mockResolvedValue(null);

      await expect(
        service.exigirLecturaCita('cita-1', 'psicologa-a'),
      ).resolves.toEqual(lectura);
      expect(citasRepository.buscarLecturaCita).toHaveBeenCalledWith(
        'cita-1',
        'psicologa-a',
      );
      await expect(
        service.exigirAccesoCita('cita-1', 'psicologa-a'),
      ).rejects.toBeInstanceOf(ForbiddenException);
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
