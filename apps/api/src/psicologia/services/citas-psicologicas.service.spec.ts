/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CitaResumen } from '@akyuam/shared';
import { CitasPsicologicasService } from './citas-psicologicas.service';
import type { AccesoPsicologiaService } from './acceso-psicologia.service';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import type { AuditService } from '../../auth/services/audit.service';

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
    borrador: false,
    reprogramadaDesdeId: null,
    atendidoPor: 'Psicóloga A',
    documento: null,
    ...overrides,
  };
}

describe('CitasPsicologicasService', () => {
  let service: CitasPsicologicasService;
  let acceso: jest.Mocked<AccesoPsicologiaService>;
  let atencionRepository: jest.Mocked<IAtencionPsicologicaRepository>;
  let citasRepository: jest.Mocked<ICitasPsicologicasRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'psicologa-a',
    username: 'psicologa.a',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    acceso = {
      exigirAccesoExpediente: jest.fn(),
      exigirAccesoCita: jest.fn(),
      exigirReferidoPsicologia: jest.fn(),
    } as unknown as jest.Mocked<AccesoPsicologiaService>;
    atencionRepository = {
      buscarExpedienteConAcceso: jest.fn(),
      obtenerOCrear: jest.fn(),
      actualizarEstado: jest.fn(),
      existeReferidoPsicologia: jest.fn(),
      tomarCaso: jest.fn(),
      listarReferenciasSinTomar: jest.fn(),
      contarCasosActivos: jest.fn(),
      contarIniciadosEnRango: jest.fn(),
      contarCerradosEnRango: jest.fn(),
      listarProcesosSinProximaCita: jest.fn(),
      listarCerradosDesde: jest.fn(),
      buscarExpedientes: jest.fn(),
      obtenerResumenExpediente: jest.fn(),
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
      listarCitasEnRango: jest.fn(),
      listarHistorial: jest.fn(),
      obtenerDetalle: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new CitasPsicologicasService(
      acceso,
      atencionRepository,
      citasRepository,
      auditService,
    );

    citasRepository.buscarCitasSolapadas.mockResolvedValue([]);
    atencionRepository.obtenerOCrear.mockResolvedValue({
      id: 'atencion-1',
      expedienteId: 'exp-1',
      estado: 'INICIO',
      psicologaAsignada: 'Psicóloga A',
      tomadaEn: null,
      fechaInicio: null,
      fechaCierre: null,
      motivoCierre: null,
      actualizadoPor: 'Psicóloga A',
      actualizadoEn: '2026-09-01T12:00:00.000Z',
      citas: [],
      historialEstados: [],
    });
    citasRepository.crear.mockResolvedValue(crearCita());
  });

  const datosProgramar = {
    fechaHora: '2026-10-01T09:00',
    modalidad: 'PRESENCIAL' as const,
    lugar: '',
    motivo: 'Seguimiento',
    tipo: 'SEGUIMIENTO' as const,
    duracionMinutos: 45,
    confirmarTraslape: false,
  };

  describe('programarCita', () => {
    it('propaga el 403 del guard sin revisar traslape', async () => {
      acceso.exigirAccesoExpediente.mockRejectedValue(
        new ForbiddenException('No tiene acceso a este expediente'),
      );

      await expect(
        service.programarCita('exp-ajeno', datosProgramar, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(citasRepository.buscarCitasSolapadas).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si hay traslape y no viene confirmarTraslape', async () => {
      citasRepository.buscarCitasSolapadas.mockResolvedValue([crearCita()]);

      await expect(
        service.programarCita('exp-1', datosProgramar, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(citasRepository.crear).not.toHaveBeenCalled();
    });

    it('permite crear la cita cuando hay traslape pero confirmarTraslape es true', async () => {
      citasRepository.buscarCitasSolapadas.mockResolvedValue([crearCita()]);

      await service.programarCita(
        'exp-1',
        { ...datosProgramar, confirmarTraslape: true },
        contexto,
      );

      expect(citasRepository.crear).toHaveBeenCalled();
    });

    it('audita la creación como CITA_PSICOLOGICA_PROGRAMADA', async () => {
      await service.programarCita('exp-1', datosProgramar, contexto);

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'CITA_PSICOLOGICA_PROGRAMADA' }),
      );
    });
  });

  const datosReprogramar = {
    fechaHora: '2026-10-02T09:00',
    modalidad: 'VIRTUAL' as const,
    lugar: '',
    motivo: 'Cambio de horario',
    confirmarTraslape: false,
  };

  describe('reprogramarCita', () => {
    it('propaga el 403 del guard antes de leer la cita origen', async () => {
      acceso.exigirAccesoCita.mockRejectedValue(
        new ForbiddenException('No tiene acceso a este expediente'),
      );

      await expect(
        service.reprogramarCita('cita-ajena', datosReprogramar, contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        citasRepository.obtenerDatosParaReprogramar,
      ).not.toHaveBeenCalled();
    });

    it('rechaza si la cita ya no está PROGRAMADA', async () => {
      citasRepository.obtenerDatosParaReprogramar.mockResolvedValue({
        atencionId: 'atencion-1',
        tipo: 'SEGUIMIENTO',
        duracionMinutos: 45,
        estado: 'ATENDIDA',
      });

      await expect(
        service.reprogramarCita('cita-1', datosReprogramar, contexto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(citasRepository.reprogramar).not.toHaveBeenCalled();
    });

    it('rechaza con 404 si la cita desaparece entre el guard y la lectura', async () => {
      citasRepository.obtenerDatosParaReprogramar.mockResolvedValue(null);

      await expect(
        service.reprogramarCita('cita-1', datosReprogramar, contexto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza con 409 si hay traslape, excluyendo la propia cita de la búsqueda', async () => {
      citasRepository.obtenerDatosParaReprogramar.mockResolvedValue({
        atencionId: 'atencion-1',
        tipo: 'SEGUIMIENTO',
        duracionMinutos: 45,
        estado: 'PROGRAMADA',
      });
      citasRepository.buscarCitasSolapadas.mockResolvedValue([crearCita()]);

      await expect(
        service.reprogramarCita('cita-1', datosReprogramar, contexto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(citasRepository.buscarCitasSolapadas).toHaveBeenCalledWith(
        expect.objectContaining({ excluirCitaId: 'cita-1' }),
      );
    });

    it('en éxito, hereda tipo/duración de la cita origen y audita CITA_PSICOLOGICA_REPROGRAMADA', async () => {
      citasRepository.obtenerDatosParaReprogramar.mockResolvedValue({
        atencionId: 'atencion-1',
        tipo: 'PRIMERA_ATENCION',
        duracionMinutos: 60,
        estado: 'PROGRAMADA',
      });
      citasRepository.reprogramar.mockResolvedValue(
        crearCita({ id: 'cita-2', reprogramadaDesdeId: 'cita-1' }),
      );

      const resultado = await service.reprogramarCita(
        'cita-1',
        datosReprogramar,
        contexto,
      );

      expect(citasRepository.reprogramar).toHaveBeenCalledWith(
        expect.objectContaining({
          citaAnteriorId: 'cita-1',
          atencionId: 'atencion-1',
          tipo: 'PRIMERA_ATENCION',
          duracionMinutos: 60,
        }),
      );
      expect(resultado.id).toBe('cita-2');
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'CITA_PSICOLOGICA_REPROGRAMADA',
          entidadId: 'cita-2',
          detalles: { citaAnteriorId: 'cita-1' },
        }),
      );
    });
  });

  function crearCitaAgregado(
    overrides: Partial<{
      fechaHora: Date;
      estado: 'PROGRAMADA' | 'ATENDIDA' | 'NO_ASISTIO' | 'REPROGRAMADA';
      tipo: 'PRIMERA_ATENCION' | 'SEGUIMIENTO';
      usuariaId: string;
      municipio: string | null;
    }> = {},
  ) {
    return {
      fechaHora: new Date('2026-10-15T15:00:00.000Z'),
      estado: 'PROGRAMADA' as const,
      tipo: 'SEGUIMIENTO' as const,
      usuariaId: 'usuaria-1',
      municipio: 'COBAN',
      ...overrides,
    };
  }

  describe('obtenerResumenAgenda', () => {
    it('agrupa las citas por fecha de calendario en GT, no por el día UTC crudo', async () => {
      // 2026-10-01T05:00:00Z son las 23:00 del 2026-09-30 en GT (UTC-6) — cae en el día anterior
      // al agrupar por calendario GT, aunque el instante UTC ya sea 1 de octubre.
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ fechaHora: new Date('2026-10-01T05:00:00.000Z') }),
      ]);

      const resumen = await service.obtenerResumenAgenda(
        { anio: 2026, mes: 9 },
        'psicologa-a',
      );

      expect(resumen).toEqual([
        expect.objectContaining({ fecha: '2026-09-30', totalCitas: 1 }),
      ]);
    });

    it('pide el rango del mes consultado con cortes en GT, siempre acotado a la psicóloga', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([]);

      await service.obtenerResumenAgenda(
        { anio: 2026, mes: 10 },
        'psicologa-a',
      );

      expect(citasRepository.listarCitasEnRango).toHaveBeenCalledWith(
        expect.objectContaining({ psicologaId: 'psicologa-a' }),
      );
    });

    it('cuenta por estado dentro de cada día', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({
          fechaHora: new Date('2026-10-15T15:00:00.000Z'),
          estado: 'ATENDIDA',
        }),
        crearCitaAgregado({
          fechaHora: new Date('2026-10-15T18:00:00.000Z'),
          estado: 'NO_ASISTIO',
        }),
      ]);

      const [dia] = await service.obtenerResumenAgenda(
        { anio: 2026, mes: 10 },
        'psicologa-a',
      );

      expect(dia.totalCitas).toBe(2);
      expect(dia.porEstado.ATENDIDA).toBe(1);
      expect(dia.porEstado.NO_ASISTIO).toBe(1);
      expect(dia.porEstado.PROGRAMADA).toBe(0);
    });
  });

  describe('listarHistorialCitas', () => {
    it('propaga el 403 del guard sin llegar al repositorio', async () => {
      acceso.exigirAccesoExpediente.mockRejectedValue(
        new ForbiddenException('No tiene acceso a este expediente'),
      );

      await expect(
        service.listarHistorialCitas('exp-ajeno', {}, 'psicologa-a'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(citasRepository.listarHistorial).not.toHaveBeenCalled();
    });

    it('resuelve la atención del expediente y pagina el historial por esa atención', async () => {
      citasRepository.listarHistorial.mockResolvedValue({
        items: [crearCita()],
        siguienteCursor: null,
      });

      await service.listarHistorialCitas(
        'exp-1',
        { estado: 'ATENDIDA', cursor: 'cursor-1' },
        'psicologa-a',
      );

      expect(citasRepository.listarHistorial).toHaveBeenCalledWith(
        expect.objectContaining({
          atencionId: 'atencion-1',
          estado: 'ATENDIDA',
          cursor: 'cursor-1',
        }),
      );
    });
  });

  describe('obtenerDetalleCita', () => {
    it('propaga el 403 del guard sin llegar al repositorio', async () => {
      acceso.exigirAccesoCita.mockRejectedValue(
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
        usuariaNombreCompleto: 'Usuaria Prueba',
      };
      citasRepository.obtenerDetalle.mockResolvedValue(detalle);

      const resultado = await service.obtenerDetalleCita(
        'cita-1',
        'psicologa-a',
      );

      expect(resultado).toEqual(detalle);
    });
  });
});
