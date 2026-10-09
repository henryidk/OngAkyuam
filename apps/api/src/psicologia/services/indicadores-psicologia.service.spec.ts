/* eslint-disable @typescript-eslint/unbound-method */
import { IndicadoresPsicologiaService } from './indicadores-psicologia.service';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import type { CitaParaAgregado } from '../interfaces/citas-psicologicas-repository.interface';
import type { IExportadorHojaCalculo } from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type { AuditService } from '../../auth/services/audit.service';

// Datos ficticios: ninguna fila corresponde a una persona real.
function crearCitaAgregado(
  overrides: Partial<CitaParaAgregado> = {},
): CitaParaAgregado {
  return {
    fechaHora: new Date('2026-06-15T15:00:00.000Z'),
    estado: 'ATENDIDA',
    tipo: 'SEGUIMIENTO',
    usuariaId: 'usuaria-1',
    ninoId: null,
    fechaNacimiento: '1990-01-10',
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    tipologias: ['FISICA'],
    procesoCodigo: 'P1-01-2026',
    ...overrides,
  };
}

function total(conteos: { clave: string; total: number }[], clave: string) {
  return conteos.find((conteo) => conteo.clave === clave)?.total;
}

describe('IndicadoresPsicologiaService', () => {
  let service: IndicadoresPsicologiaService;
  let atencionRepository: jest.Mocked<IAtencionPsicologicaRepository>;
  let citasRepository: jest.Mocked<ICitasPsicologicasRepository>;
  let exportador: jest.Mocked<IExportadorHojaCalculo>;
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
      fechaPrimerProceso: jest.fn(),
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

    exportador = {
      tipoContenido: 'application/test',
      extension: 'xlsx',
      generar: jest.fn().mockResolvedValue(Buffer.from('excel')),
    };

    service = new IndicadoresPsicologiaService(
      atencionRepository,
      citasRepository,
      exportador,
      auditService,
    );

    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T18:00:00.000Z'));
    atencionRepository.fechaPrimerProceso.mockResolvedValue(null);

    atencionRepository.contarCasosActivos.mockResolvedValue(0);
    atencionRepository.contarIniciadosEnRango.mockResolvedValue(0);
    atencionRepository.contarCerradosEnRango.mockResolvedValue(0);
    citasRepository.listarCitasEnRango.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const consultar = () =>
    service.obtenerIndicadores({ anio: 2026 }, 'psicologa-a', contexto);

  describe('obtenerIndicadores', () => {
    it('pide el rango de citas con cortes de año completo en GT (1 ene - 31 dic), no en UTC', async () => {
      await consultar();

      const params = citasRepository.listarCitasEnRango.mock.calls[0][0];
      expect(params.psicologaId).toBe('psicologa-a');
      // Medianoche del 1 de enero en GT (UTC-6) es 06:00 UTC.
      expect(params.desde.toISOString()).toBe('2026-01-01T06:00:00.000Z');
      // Fin del 31 de diciembre en GT (23:59:59.999) es 05:59:59.999 UTC del 1 de enero siguiente.
      expect(params.hasta.toISOString()).toBe('2027-01-01T05:59:59.999Z');
    });

    it('devuelve los 12 meses de enero a diciembre, con ceros donde no hubo atención', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ fechaHora: new Date('2026-10-05T15:00:00.000Z') }),
        crearCitaAgregado({ fechaHora: new Date('2026-03-05T15:00:00.000Z') }),
      ]);

      const { meses } = await consultar();

      expect(meses).toHaveLength(12);
      expect(meses.map((mes) => mes.personasAtendidas)).toEqual([
        0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0,
      ]);
    });

    it('agrupa por mes de calendario GT, no por mes UTC crudo', async () => {
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

      const { meses } = await consultar();

      expect(meses[5].personasAtendidas).toBe(1);
      expect(meses[6].personasAtendidas).toBe(1);
    });

    it('cuenta a cada persona una sola vez en el mes y en el año aunque tenga varias sesiones', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ fechaHora: new Date('2026-02-05T15:00:00.000Z') }),
        crearCitaAgregado({ fechaHora: new Date('2026-02-20T15:00:00.000Z') }),
        crearCitaAgregado({ fechaHora: new Date('2026-11-05T15:00:00.000Z') }),
      ]);

      const { anual, meses } = await consultar();

      expect(meses[1].personasAtendidas).toBe(1);
      expect(meses[1].sesionesRealizadas).toBe(2);
      expect(anual.personasAtendidas).toBe(1);
      expect(anual.sesionesRealizadas).toBe(3);
    });

    it('cuenta al hijo/a como una persona distinta de su madre', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado(),
        crearCitaAgregado({ ninoId: 'nino-1', fechaNacimiento: '2018-03-01' }),
      ]);

      const { anual } = await consultar();

      expect(anual.personasAtendidas).toBe(2);
      expect(total(anual.desgloses.rangoEdad, '0-13')).toBe(1);
      expect(total(anual.desgloses.rangoEdad, '31-60')).toBe(1);
    });

    it('no cuenta como atendida a quien solo tuvo inasistencias o citas programadas', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ estado: 'NO_ASISTIO' }),
        crearCitaAgregado({ estado: 'PROGRAMADA', usuariaId: 'usuaria-2' }),
      ]);

      const { anual } = await consultar();

      expect(anual.personasAtendidas).toBe(0);
      expect(anual.inasistencias).toBe(1);
      expect(anual.citas).toBe(2);
      expect(total(anual.desgloses.municipio, 'COBAN')).toBe(0);
    });

    it('los desgloses cuentan personas distintas y cuadran con el total de personas', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado(),
        crearCitaAgregado(),
        crearCitaAgregado({
          usuariaId: 'usuaria-2',
          grupoEtnico: 'LADINO',
          municipio: null,
          tipologias: ['FISICA', 'SEXUAL'],
        }),
      ]);

      const { anual } = await consultar();
      const suma = (conteos: { total: number }[]) =>
        conteos.reduce((acumulado, conteo) => acumulado + conteo.total, 0);

      expect(anual.personasAtendidas).toBe(2);
      expect(suma(anual.desgloses.municipio)).toBe(2);
      expect(suma(anual.desgloses.grupoEtnico)).toBe(2);
      expect(suma(anual.desgloses.rangoEdad)).toBe(2);
      expect(total(anual.desgloses.municipio, 'COBAN')).toBe(1);
      expect(total(anual.desgloses.municipio, 'FUERA_DE_ALTA_VERAPAZ')).toBe(1);
      // Una persona con dos tipologías suma en ambas.
      expect(total(anual.desgloses.tipologia, 'FISICA')).toBe(2);
      expect(total(anual.desgloses.tipologia, 'SEXUAL')).toBe(1);
    });

    it('entrega etiquetas legibles, nunca solo la clave del catálogo', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ municipio: 'SAN_CRISTOBAL_VERAPAZ' }),
      ]);

      const { anual } = await consultar();

      expect(
        anual.desgloses.municipio.find(
          (conteo) => conteo.clave === 'SAN_CRISTOBAL_VERAPAZ',
        )?.etiqueta,
      ).toBe('San Cristóbal Verapaz');
      const { desgloses } = anual;
      const etiquetas = [
        ...desgloses.rangoEdad,
        ...desgloses.grupoEtnico,
        ...desgloses.tipologia,
        ...desgloses.municipio,
        ...desgloses.citasPorEstado,
        ...desgloses.citasPorTipo,
      ].map((conteo) => conteo.etiqueta);
      for (const etiqueta of etiquetas) {
        expect(etiqueta).not.toMatch(/_/);
      }
    });

    it('cuenta las citas por estado y por tipo', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ estado: 'ATENDIDA', tipo: 'PRIMERA_ATENCION' }),
        crearCitaAgregado({ estado: 'NO_ASISTIO' }),
        crearCitaAgregado({ estado: 'NO_ASISTIO' }),
        crearCitaAgregado({ estado: 'PROGRAMADA' }),
      ]);

      const { anual } = await consultar();

      expect(total(anual.desgloses.citasPorEstado, 'NO_ASISTIO')).toBe(2);
      expect(total(anual.desgloses.citasPorEstado, 'ATENDIDA')).toBe(1);
      expect(total(anual.desgloses.citasPorTipo, 'PRIMERA_ATENCION')).toBe(1);
      expect(total(anual.desgloses.citasPorTipo, 'SEGUIMIENTO')).toBe(3);
    });

    it('ofrece los años desde mi primer proceso hasta el actual, del más reciente al más antiguo', async () => {
      atencionRepository.fechaPrimerProceso.mockResolvedValue(
        new Date('2024-05-02T15:00:00.000Z'),
      );

      const { aniosDisponibles } = await consultar();

      expect(aniosDisponibles).toEqual([2026, 2025, 2024]);
      expect(atencionRepository.fechaPrimerProceso).toHaveBeenCalledWith(
        'psicologa-a',
      );
    });

    it('sin procesos todavía, ofrece solo el año en curso', async () => {
      expect((await consultar()).aniosDisponibles).toEqual([2026]);
    });

    it('compone los conteos de procesos desde IAtencionPsicologicaRepository, acotados a la psicóloga', async () => {
      atencionRepository.contarCasosActivos.mockResolvedValue(5);
      atencionRepository.contarIniciadosEnRango.mockResolvedValue(2);
      atencionRepository.contarCerradosEnRango.mockResolvedValue(1);

      const indicadores = await consultar();

      expect(atencionRepository.contarCasosActivos).toHaveBeenCalledWith(
        'psicologa-a',
      );
      expect(indicadores.procesosActivos).toBe(5);
      expect(indicadores.procesosIniciadosEnElAnio).toBe(2);
      expect(indicadores.procesosCerradosEnElAnio).toBe(1);
    });

    it('audita la consulta como INDICADORES_PSICOLOGIA_CONSULTADOS con el año, sin datos sensibles', async () => {
      await consultar();

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'INDICADORES_PSICOLOGIA_CONSULTADOS',
          detalles: { anio: 2026 },
        }),
      );
    });
  });

  describe('exportar', () => {
    const exportar = () =>
      service.exportar({ anio: 2026 }, 'psicologa-a', contexto);

    it('pide solo las citas de la psicóloga que descarga', async () => {
      await exportar();

      expect(citasRepository.listarCitasEnRango).toHaveBeenCalledWith(
        expect.objectContaining({ psicologaId: 'psicologa-a' }),
      );
    });

    it('genera una fila por persona atendida, con etiquetas y sin nombres', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ fechaHora: new Date('2026-02-05T15:00:00.000Z') }),
        crearCitaAgregado({ fechaHora: new Date('2026-03-05T15:00:00.000Z') }),
        crearCitaAgregado({
          fechaHora: new Date('2026-04-05T15:00:00.000Z'),
          estado: 'NO_ASISTIO',
        }),
      ]);

      await exportar();

      const hoja = exportador.generar.mock.calls[0][0];
      expect(hoja.columnas.map((columna) => columna.titulo)).not.toContain(
        'Usuaria',
      );
      expect(hoja.filas).toEqual([
        [
          1,
          'Usuaria',
          'P1-01-2026',
          36,
          '31 a 60 años',
          "Maya Q'eqchi'",
          'Cobán',
          'Física',
          2,
          1,
          '2026-02-05',
          '2026-03-05',
        ],
      ]);
    });

    it('audita la descarga con el año y el número de filas, y nombra el archivo sin datos personales', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado(),
      ]);

      const archivo = await exportar();

      expect(archivo.nombreArchivo).toBe(
        'psicologia-personas-atendidas_2026.xlsx',
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'REPORTE_PSICOLOGIA_EXPORTADO',
          detalles: { anio: 2026, filas: 1 },
        }),
      );
    });
  });
});
