/* eslint-disable @typescript-eslint/unbound-method */
import { IndicadoresPsicologiaService } from './indicadores-psicologia.service';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import type { AuditService } from '../../auth/services/audit.service';

function crearCitaAgregado(
  overrides: Partial<{
    fechaHora: Date;
    estado:
      'PROGRAMADA' | 'ATENDIDA' | 'CANCELADA' | 'NO_ASISTIO' | 'REPROGRAMADA';
    tipo: 'PRIMERA_ATENCION' | 'SEGUIMIENTO' | 'CIERRE';
    usuariaId: string;
    municipio: string | null;
  }> = {},
) {
  return {
    fechaHora: new Date('2026-06-15T15:00:00.000Z'),
    estado: 'ATENDIDA' as const,
    tipo: 'SEGUIMIENTO' as const,
    usuariaId: 'usuaria-1',
    municipio: 'COBAN',
    ...overrides,
  };
}

describe('IndicadoresPsicologiaService', () => {
  let service: IndicadoresPsicologiaService;
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
    atencionRepository = {
      tomarCaso: jest.fn(),
      contarCasosActivos: jest.fn(),
      contarIniciadosEnRango: jest.fn(),
      contarCerradosEnRango: jest.fn(),
    };
    citasRepository = {
      buscarAccesoCita: jest.fn(),
      buscarLecturaCita: jest.fn(),
      buscarCitasSolapadas: jest.fn(),
      registrarConsulta: jest.fn(),
      listarCitasEnRango: jest.fn(),
      obtenerDetalle: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new IndicadoresPsicologiaService(
      atencionRepository,
      citasRepository,
      auditService,
    );

    atencionRepository.contarCasosActivos.mockResolvedValue(0);
    atencionRepository.contarIniciadosEnRango.mockResolvedValue(0);
    atencionRepository.contarCerradosEnRango.mockResolvedValue(0);
    citasRepository.listarCitasEnRango.mockResolvedValue([]);
  });

  describe('obtenerIndicadores', () => {
    it('pide el rango de citas con cortes de año completo en GT (1 ene - 31 dic), no en UTC', async () => {
      await service.obtenerIndicadores({ anio: 2026 }, 'psicologa-a', contexto);

      const params = citasRepository.listarCitasEnRango.mock.calls[0][0];
      expect(params.psicologaId).toBe('psicologa-a');
      // Medianoche del 1 de enero en GT (UTC-6) es 06:00 UTC.
      expect(params.desde.toISOString()).toBe('2026-01-01T06:00:00.000Z');
      // Fin del 31 de diciembre en GT (23:59:59.999) es 05:59:59.999 UTC del 1 de enero siguiente.
      expect(params.hasta.toISOString()).toBe('2027-01-01T05:59:59.999Z');
    });

    it('agrupa personas atendidas por mes de calendario GT, no por mes UTC crudo', async () => {
      // 2026-07-01T04:00:00Z son las 22:00 del 2026-06-30 en GT — debe contar en junio, no julio.
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({
          fechaHora: new Date('2026-07-01T04:00:00.000Z'),
          usuariaId: 'usuaria-1',
        }),
        crearCitaAgregado({
          fechaHora: new Date('2026-07-01T18:00:00.000Z'),
          usuariaId: 'usuaria-2',
        }),
      ]);

      const indicadores = await service.obtenerIndicadores(
        { anio: 2026 },
        'psicologa-a',
        contexto,
      );

      expect(indicadores.personasAtendidasPorMes['06']).toBe(1);
      expect(indicadores.personasAtendidasPorMes['07']).toBe(1);
    });

    it('cuenta cada usuaria una sola vez por mes aunque tenga varias citas ese mes', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({
          fechaHora: new Date('2026-06-05T15:00:00.000Z'),
          usuariaId: 'usuaria-1',
        }),
        crearCitaAgregado({
          fechaHora: new Date('2026-06-20T15:00:00.000Z'),
          usuariaId: 'usuaria-1',
        }),
      ]);

      const indicadores = await service.obtenerIndicadores(
        { anio: 2026 },
        'psicologa-a',
        contexto,
      );

      expect(indicadores.personasAtendidasPorMes['06']).toBe(1);
      expect(indicadores.personasAtendidasEnElAnio).toBe(1);
    });

    it('cuenta la misma usuaria en el total anual una sola vez aunque aparezca en varios meses', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({
          fechaHora: new Date('2026-02-05T15:00:00.000Z'),
          usuariaId: 'usuaria-1',
        }),
        crearCitaAgregado({
          fechaHora: new Date('2026-11-05T15:00:00.000Z'),
          usuariaId: 'usuaria-1',
        }),
      ]);

      const indicadores = await service.obtenerIndicadores(
        { anio: 2026 },
        'psicologa-a',
        contexto,
      );

      expect(indicadores.personasAtendidasEnElAnio).toBe(1);
    });

    it('calcula la tasa de inasistencia sobre el total de citas del año', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ estado: 'ATENDIDA' }),
        crearCitaAgregado({ estado: 'NO_ASISTIO' }),
        crearCitaAgregado({ estado: 'NO_ASISTIO' }),
        crearCitaAgregado({ estado: 'PROGRAMADA' }),
      ]);

      const indicadores = await service.obtenerIndicadores(
        { anio: 2026 },
        'psicologa-a',
        contexto,
      );

      expect(indicadores.tasaInasistencia).toBe(0.5);
      expect(indicadores.citasPorEstado.NO_ASISTIO).toBe(2);
      expect(indicadores.citasPorEstado.ATENDIDA).toBe(1);
    });

    it('devuelve tasa de inasistencia 0 cuando no hay citas en el año, sin dividir por cero', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([]);

      const indicadores = await service.obtenerIndicadores(
        { anio: 2026 },
        'psicologa-a',
        contexto,
      );

      expect(indicadores.tasaInasistencia).toBe(0);
    });

    it('distribuye por tipo de cita y por municipio, ignorando municipio nulo', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ tipo: 'PRIMERA_ATENCION', municipio: 'COBAN' }),
        crearCitaAgregado({ tipo: 'SEGUIMIENTO', municipio: 'COBAN' }),
        crearCitaAgregado({ tipo: 'SEGUIMIENTO', municipio: null }),
      ]);

      const indicadores = await service.obtenerIndicadores(
        { anio: 2026 },
        'psicologa-a',
        contexto,
      );

      expect(indicadores.distribucionPorTipoCita.PRIMERA_ATENCION).toBe(1);
      expect(indicadores.distribucionPorTipoCita.SEGUIMIENTO).toBe(2);
      expect(indicadores.distribucionPorMunicipio.COBAN).toBe(2);
      expect(Object.keys(indicadores.distribucionPorMunicipio)).toHaveLength(1);
    });

    it('compone los conteos de procesos desde IAtencionPsicologicaRepository, acotados a la psicóloga', async () => {
      atencionRepository.contarCasosActivos.mockResolvedValue(5);
      atencionRepository.contarIniciadosEnRango.mockResolvedValue(2);
      atencionRepository.contarCerradosEnRango.mockResolvedValue(1);

      const indicadores = await service.obtenerIndicadores(
        { anio: 2026 },
        'psicologa-a',
        contexto,
      );

      expect(atencionRepository.contarCasosActivos).toHaveBeenCalledWith(
        'psicologa-a',
      );
      expect(indicadores.procesosActivos).toBe(5);
      expect(indicadores.procesosIniciadosEnElAnio).toBe(2);
      expect(indicadores.procesosCerradosEnElAnio).toBe(1);
    });

    it('audita la consulta como INDICADORES_PSICOLOGIA_CONSULTADOS con el año, sin datos sensibles', async () => {
      await service.obtenerIndicadores({ anio: 2026 }, 'psicologa-a', contexto);

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'INDICADORES_PSICOLOGIA_CONSULTADOS',
          detalles: { anio: 2026 },
        }),
      );
    });
  });
});
