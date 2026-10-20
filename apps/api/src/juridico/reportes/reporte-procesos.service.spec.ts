/* eslint-disable @typescript-eslint/unbound-method */
import type { AuditService } from '../../auth/services/audit.service';
import type { IExportadorHojaCalculo } from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type {
  FilaProcesoRow,
  IReporteProcesosRepository,
} from '../interfaces/reporte-procesos-repository.interface';
import { ABOGADA_ID, contexto, relojFijo } from '../pruebas/dobles';
import {
  aFilaHoja,
  aFilaReporte,
  armarDesgloses,
  COLUMNAS_PROCESOS,
  ReporteProcesosService,
} from './reporte-procesos.service';

const ANIO = 2026;

// Datos ficticios: nombres inventados.
function proceso(overrides: Partial<FilaProcesoRow> = {}): FilaProcesoRow {
  return {
    numero: 1,
    consecutivo: 2,
    expedienteNumero: '05-2026',
    numeroJudicial: null,
    fechaInicio: '2026-03-02',
    fechaCierre: null,
    tipo: 'FIJACION_PENSION_ALIMENTICIA',
    estado: 'EN_TRAMITE',
    abierto: true,
    formaFinalizacion: null,
    abogada: 'Abogada Ficticia',
    nombres: 'Ana Prueba',
    apellidos: 'Ficticia',
    proximaAudiencia: null,
    ultimaAudienciaRealizada: null,
    ...overrides,
  };
}

describe('aFilaReporte', () => {
  it('arma la fila con expediente, número de proceso y cartera del año', () => {
    expect(aFilaReporte(proceso(), ANIO)).toEqual({
      numero: 1,
      expedienteNumero: '05-2026',
      numeroProceso: 2,
      usuaria: 'Ana Prueba Ficticia',
      tipo: 'FIJACION_PENSION_ALIMENTICIA',
      fechaInicio: '2026-03-02',
      abogada: 'Abogada Ficticia',
      estado: 'EN_TRAMITE',
      formaFinalizacion: null,
      fechaCierre: null,
      numeroJudicial: null,
      cartera: '2026',
      proximaAudiencia: null,
      ultimaAudienciaRealizada: null,
    });
  });

  it('un proceso de un año anterior que sigue abierto es de seguimiento', () => {
    expect(
      aFilaReporte(proceso({ fechaInicio: '2024-11-30' }), ANIO).cartera,
    ).toBe('Seguimiento (2024)');
  });

  it('un proceso de un año anterior ya cerrado no tiene cartera', () => {
    const fila = aFilaReporte(
      proceso({ fechaInicio: '2024-11-30', abierto: false }),
      ANIO,
    );
    expect(fila.cartera).toBe('');
  });

  it('las audiencias se muestran con fecha y hora de Guatemala, aunque crucen la medianoche UTC', () => {
    const fila = aFilaReporte(
      proceso({
        // 21/10/2026 20:30 en Guatemala = 22/10/2026 02:30 UTC.
        proximaAudiencia: new Date('2026-10-22T02:30:00.000Z'),
        ultimaAudienciaRealizada: new Date('2026-09-01T15:00:00.000Z'),
      }),
      ANIO,
    );
    expect(fila.proximaAudiencia).toEqual({
      fecha: '2026-10-21',
      hora: '20:30',
    });
    expect(fila.ultimaAudienciaRealizada).toEqual({
      fecha: '2026-09-01',
      hora: '09:00',
    });
  });

  it('la forma y la fecha de cierre solo se muestran si el proceso está finalizado', () => {
    const datosCierre = {
      formaFinalizacion: 'SENTENCIA',
      fechaCierre: '2026-09-01',
    } as const;

    expect(
      aFilaReporte(proceso({ ...datosCierre, estado: 'FINALIZADO' }), ANIO),
    ).toMatchObject(datosCierre);
    expect(
      aFilaReporte(proceso({ ...datosCierre, estado: 'SUSPENDIDO' }), ANIO),
    ).toMatchObject({ formaFinalizacion: null, fechaCierre: null });
  });
});

describe('aFilaHoja', () => {
  it('tiene una celda por columna, con etiquetas y vacíos en lugar de null', () => {
    const celdas = aFilaHoja(
      aFilaReporte(
        proceso({
          estado: 'FINALIZADO',
          abierto: false,
          formaFinalizacion: 'CONVENIO',
          fechaCierre: '2026-09-01',
          abogada: null,
          ultimaAudienciaRealizada: new Date('2026-08-10T16:30:00.000Z'),
        }),
        ANIO,
      ),
    );

    expect(celdas).toHaveLength(COLUMNAS_PROCESOS.length);
    expect(celdas.slice(0, 3)).toEqual([1, '05-2026', 2]);
    expect(celdas[6]).toBe('');
    expect(celdas[7]).toBe('Finalizado');
    expect(celdas[8]).toBe('Convenio');
    expect(celdas[9]).toBe('2026-09-01');
    expect(celdas[10]).toBe('');
    expect(celdas[11]).toBe('2026');
    expect(celdas[12]).toBe('');
    expect(celdas[13]).toBe('10/08/2026 10:30');
  });
});

describe('armarDesgloses', () => {
  it('incluye todas las categorías del catálogo aunque tengan 0', () => {
    const desgloses = armarDesgloses([]);

    expect(desgloses.estado.map((c) => c.clave)).toEqual([
      'EN_TRAMITE',
      'SUSPENDIDO',
      'FINALIZADO',
      'ABANDONADO',
    ]);
    expect(desgloses.formaFinalizacion).toHaveLength(4);
    expect(desgloses.categoria).toHaveLength(6);
    expect(
      [
        ...desgloses.estado,
        ...desgloses.formaFinalizacion,
        ...desgloses.categoria,
      ].every((c) => c.total === 0),
    ).toBe(true);
  });

  it('suma por estado, por forma (solo finalizados) y por categoría del tipo', () => {
    const desgloses = armarDesgloses([
      {
        estado: 'EN_TRAMITE',
        formaFinalizacion: null,
        tipo: 'FIJACION_PENSION_ALIMENTICIA',
        total: 3,
      },
      {
        estado: 'FINALIZADO',
        formaFinalizacion: 'SENTENCIA',
        tipo: 'MODIFICACION_PENSION_ALIMENTICIA',
        total: 2,
      },
      {
        estado: 'FINALIZADO',
        formaFinalizacion: 'CONVENIO',
        tipo: 'DIVORCIO_MUTUO_ACUERDO',
        total: 1,
      },
    ]);

    const total = (lista: { clave: string; total: number }[], clave: string) =>
      lista.find((c) => c.clave === clave)?.total;
    expect(total(desgloses.estado, 'EN_TRAMITE')).toBe(3);
    expect(total(desgloses.estado, 'FINALIZADO')).toBe(3);
    expect(total(desgloses.formaFinalizacion, 'SENTENCIA')).toBe(2);
    expect(total(desgloses.formaFinalizacion, 'CONVENIO')).toBe(1);
    expect(total(desgloses.categoria, 'ALIMENTOS')).toBe(5);
    expect(total(desgloses.categoria, 'FAMILIA')).toBe(1);
  });
});

describe('ReporteProcesosService', () => {
  let repositorio: jest.Mocked<IReporteProcesosRepository>;
  let exportador: jest.Mocked<IExportadorHojaCalculo>;
  let auditService: jest.Mocked<Pick<AuditService, 'registrar'>>;
  let service: ReporteProcesosService;

  const query = {
    cartera: 'TODOS',
    desde: '2026-01-01',
    hasta: '2026-10-05',
    estado: 'FINALIZADO',
    abogadaId: ABOGADA_ID,
    tipo: 'DIVORCIO_MUTUO_ACUERDO',
  } as const;

  function crearServicio(ahora?: Date) {
    return new ReporteProcesosService(
      repositorio,
      exportador,
      auditService as unknown as AuditService,
      relojFijo(ahora),
    );
  }

  beforeEach(() => {
    repositorio = {
      filas: jest.fn().mockResolvedValue([proceso()]),
      conteos: jest.fn().mockResolvedValue([
        {
          estado: 'EN_TRAMITE',
          formaFinalizacion: null,
          tipo: 'FIJACION_PENSION_ALIMENTICIA',
          total: 4,
        },
      ]),
      totalesPersonas: jest
        .fn()
        .mockResolvedValue({ expedientes: 3, usuarias: 2 }),
    };
    exportador = {
      tipoContenido: 'application/test',
      extension: 'xlsx',
      generar: jest.fn().mockResolvedValue(Buffer.from('archivo')),
    };
    auditService = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = crearServicio();
  });

  it('traduce los filtros: cartera con rango, estado, abogada y tipo concretos', async () => {
    await service.vistaPrevia(query, contexto);

    expect(repositorio.conteos).toHaveBeenCalledWith({
      cartera: 'TODOS',
      anioActual: 2026,
      rango: { desde: '2026-01-01', hasta: '2026-10-05' },
      estado: 'FINALIZADO',
      abogadaId: ABOGADA_ID,
      tipo: 'DIVORCIO_MUTUO_ACUERDO',
    });
  });

  it('en "Año en curso" ignora el rango; "Todos", sin abogada y sin tipo se traducen a null', async () => {
    await service.vistaPrevia(
      {
        cartera: 'ANIO',
        desde: '2020-01-01',
        hasta: '2020-12-31',
        estado: 'TODOS',
      },
      contexto,
    );

    expect(repositorio.conteos).toHaveBeenCalledWith({
      cartera: 'ANIO',
      anioActual: 2026,
      rango: null,
      estado: null,
      abogadaId: null,
      tipo: null,
    });
  });

  it('el año en curso es el de Guatemala: el 1 de enero UTC todavía es 31 de diciembre allá', async () => {
    // 01/01/2027 03:00 UTC = 31/12/2026 21:00 en Guatemala.
    await crearServicio(new Date('2027-01-01T03:00:00.000Z')).vistaPrevia(
      { cartera: 'ANIO', estado: 'TODOS' },
      contexto,
    );

    expect(repositorio.conteos).toHaveBeenCalledWith(
      expect.objectContaining({ anioActual: 2026 }),
    );
  });

  it('la vista previa trae totales y audita solo los filtros', async () => {
    const reporte = await service.vistaPrevia(query, contexto);

    expect(reporte.totales).toEqual({
      procesos: 4,
      expedientes: 3,
      usuarias: 2,
    });
    expect(reporte.vistaPrevia).toHaveLength(1);
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REPORTE_CONSULTADO',
        entidad: 'Reporte',
        detalles: {
          reporte: 'PROCESOS_JURIDICOS',
          cartera: 'TODOS',
          anio: 2026,
          desde: '2026-01-01',
          hasta: '2026-10-05',
          estado: 'FINALIZADO',
          abogadaId: ABOGADA_ID,
          tipo: 'DIVORCIO_MUTUO_ACUERDO',
        },
      }),
    );
    expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
      'Ana Prueba',
    );
  });

  it('el Excel trae todas las filas, audita el export y no lleva datos personales en el nombre', async () => {
    const archivo = await service.exportar(query, contexto);

    expect(repositorio.filas).toHaveBeenCalledWith(expect.anything(), null);
    expect(archivo.nombreArchivo).toBe(
      'procesos-juridicos_2026-01-01_2026-10-05.xlsx',
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REPORTE_JURIDICO_EXPORTADO',
        detalles: expect.objectContaining({ filas: 1 }) as unknown,
      }),
    );
    expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
      'Ana Prueba',
    );
  });

  it('el nombre del archivo dice la cartera: año o seguimiento con la fecha de hoy', async () => {
    const anio = await service.exportar(
      { cartera: 'ANIO', estado: 'TODOS' },
      contexto,
    );
    const seguimiento = await service.exportar(
      { cartera: 'SEGUIMIENTO', estado: 'TODOS' },
      contexto,
    );

    expect(anio.nombreArchivo).toBe('procesos-juridicos_2026.xlsx');
    expect(seguimiento.nombreArchivo).toBe(
      'procesos-juridicos_seguimiento_2026-10-19.xlsx',
    );
  });
});
