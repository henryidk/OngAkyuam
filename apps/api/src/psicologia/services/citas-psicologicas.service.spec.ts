/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type { CitaResumen } from '@akyuam/shared';
import { CitasPsicologicasService } from './citas-psicologicas.service';
import type { AccesoPsicologiaService } from './acceso-psicologia.service';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';

function crearCita(overrides: Partial<CitaResumen> = {}): CitaResumen {
  return {
    id: 'cita-1',
    fechaHora: '2026-10-01T15:00:00.000Z',
    modalidad: 'PRESENCIAL',
    lugar: null,
    motivo: 'Seguimiento',
    tipo: 'SEGUIMIENTO',
    duracionMinutos: 45,
    estado: 'PROGRAMADA',
    observaciones: null,
    acuerdos: null,
    motivoNoAsistencia: null,
    temas: null,
    intervencion: null,
    recomendaciones: null,
    clinica: null,
    enfoqueTerapeutico: null,
    borrador: false,
    reprogramadaDesdeId: null,
    atendidoPor: 'Psicóloga A',
    documento: null,
    ...overrides,
  };
}

function detalleCon(overrides: Partial<CitaResumen> = {}) {
  return {
    ...crearCita(overrides),
    expedienteId: 'exp-1',
    numero: '2026-001',
    procesoId: 'atencion-1',
    procesoCodigo: '2026-001',
    procesoEtapa: 'SEGUIMIENTO' as const,
    ninoNombreCompleto: null,
    usuariaNombreCompleto: 'Usuaria Prueba',
  };
}

describe('CitasPsicologicasService', () => {
  let service: CitasPsicologicasService;
  let acceso: jest.Mocked<AccesoPsicologiaService>;
  let citasRepository: jest.Mocked<ICitasPsicologicasRepository>;

  beforeEach(() => {
    acceso = {
      exigirLecturaCita: jest.fn(),
    } as unknown as jest.Mocked<AccesoPsicologiaService>;
    citasRepository = {
      buscarAccesoCita: jest.fn(),
      buscarAutoriaCita: jest.fn(),
      buscarLecturaCita: jest.fn(),
      buscarCitasSolapadas: jest.fn(),
      registrarConsulta: jest.fn(),
      listarCitasEnRango: jest.fn(),
      obtenerDetalle: jest.fn(),
      buscarUltimaClinica: jest.fn().mockResolvedValue(null),
    };

    service = new CitasPsicologicasService(acceso, citasRepository);
  });

  describe('obtenerDetalleCita', () => {
    it('propaga el 403 del guard sin llegar al repositorio', async () => {
      acceso.exigirLecturaCita.mockRejectedValue(
        new ForbiddenException('No tiene acceso a esta cita'),
      );

      await expect(
        service.obtenerDetalleCita('cita-ajena', 'psicologa-a'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(citasRepository.obtenerDetalle).not.toHaveBeenCalled();
    });

    it('lanza 404 si la cita desaparece entre el guard y la lectura', async () => {
      citasRepository.obtenerDetalle.mockResolvedValue(null);

      await expect(
        service.obtenerDetalleCita('cita-1', 'psicologa-a'),
      ).rejects.toThrow('Cita no encontrada');
    });

    it('en éxito, devuelve el detalle del repositorio', async () => {
      const detalle = {
        ...crearCita(),
        expedienteId: 'exp-1',
        numero: '2026-001',
        procesoId: 'atencion-1',
        procesoCodigo: '2026-001',
        procesoEtapa: 'SEGUIMIENTO' as const,
        ninoNombreCompleto: null,
        usuariaNombreCompleto: 'Usuaria Prueba',
      };
      citasRepository.obtenerDetalle.mockResolvedValue(detalle);

      const resultado = await service.obtenerDetalleCita(
        'cita-1',
        'psicologa-a',
      );

      expect(resultado).toEqual({ ...detalle, clinicaSugerida: null });
    });

    it('sugiere la clínica ya anotada en la cita, sin buscar otra', async () => {
      citasRepository.obtenerDetalle.mockResolvedValue(
        detalleCon({ clinica: 'CLINICA_2' }),
      );

      const resultado = await service.obtenerDetalleCita(
        'cita-1',
        'psicologa-a',
      );

      expect(resultado.clinicaSugerida).toBe('CLINICA_2');
      expect(citasRepository.buscarUltimaClinica).not.toHaveBeenCalled();
    });

    it('sin clínica en la cita, sugiere la última que usó quien la consulta', async () => {
      citasRepository.obtenerDetalle.mockResolvedValue(detalleCon());
      citasRepository.buscarUltimaClinica.mockResolvedValue('CLINICA_1');

      const resultado = await service.obtenerDetalleCita(
        'cita-1',
        'psicologa-b',
      );

      expect(resultado.clinicaSugerida).toBe('CLINICA_1');
      expect(citasRepository.buscarUltimaClinica).toHaveBeenCalledWith(
        'psicologa-b',
      );
    });

    it('autoriza con el nivel de lectura: la cita de una colega también se puede ver', async () => {
      citasRepository.obtenerDetalle.mockResolvedValue(null);

      await expect(
        service.obtenerDetalleCita('cita-1', 'psicologa-a'),
      ).rejects.toThrow();
      expect(acceso.exigirLecturaCita).toHaveBeenCalledWith(
        'cita-1',
        'psicologa-a',
      );
    });
  });
});
