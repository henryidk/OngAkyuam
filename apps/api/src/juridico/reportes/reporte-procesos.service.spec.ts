/* eslint-disable @typescript-eslint/unbound-method */
import type { AuditService } from '../../auth/services/audit.service';
import type { IExportadorHojaCalculo } from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type {
  FilaProcesoRow,
  IReporteProcesosRepository,
} from '../interfaces/reporte-procesos-repository.interface';
import { contexto } from '../pruebas/dobles';
import {
  aFilaHoja,
  aFilaReporte,
  armarDesgloses,
  COLUMNAS_PROCESOS,
  ReporteProcesosService,
} from './reporte-procesos.service';

const ABOGADA_ID = '88888888-8888-4888-8888-888888888888';

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
    formaFinalizacion: null,
    abogada: 'Abogada Ficticia',
    nombres: 'Ana Prueba',
    apellidos: 'Ficticia',
    edad: 31,
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    municipioOtro: null,
    ...overrides,
  };
}

describe('aFilaReporte', () => {
  it('arma el código del proceso y las etiquetas de la usuaria', () => {
    expect(aFilaReporte(proceso())).toEqual({
      numero: 1,
      codigo: 'J2-05-2026',
      numeroJudicial: null,
      fechaInicio: '2026-03-02',
      usuaria: 'Ana Prueba Ficticia',
      edad: 31,
      rangoEdad: '31 a 60 años',
      grupoEtnico: "Maya Q'eqchi'",
      municipio: 'Cobán',
      tipo: 'FIJACION_PENSION_ALIMENTICIA',
      abogada: 'Abogada Ficticia',
      estado: 'EN_TRAMITE',
      formaFinalizacion: null,
      fechaCierre: null,
    });
  });

  it('fuera de Alta Verapaz usa el municipio escrito a mano', () => {
    const fila = aFilaReporte(
      proceso({ municipio: null, municipioOtro: 'Mixco' }),
    );
    expect(fila.municipio).toBe('Mixco');
  });

  it('la forma y la fecha de cierre solo se muestran si el proceso está finalizado', () => {
    const datosCierre = {
      formaFinalizacion: 'SENTENCIA',
      fechaCierre: '2026-09-01',
    } as const;

    expect(
      aFilaReporte(proceso({ ...datosCierre, estado: 'FINALIZADO' })),
    ).toMatchObject(datosCierre);
    expect(
      aFilaReporte(proceso({ ...datosCierre, estado: 'SUSPENDIDO' })),
    ).toMatchObject({ formaFinalizacion: null, fechaCierre: null });
  });
});

describe('aFilaHoja', () => {
  it('tiene una celda por columna, con etiquetas y vacíos en lugar de null', () => {
    const celdas = aFilaHoja(
      aFilaReporte(
        proceso({
          estado: 'FINALIZADO',
          formaFinalizacion: 'CONVENIO',
          fechaCierre: '2026-09-01',
          abogada: null,
        }),
      ),
    );

    expect(celdas).toHaveLength(COLUMNAS_PROCESOS.length);
    expect(celdas[2]).toBe('');
    expect(celdas[10]).toBe('');
    expect(celdas[11]).toBe('Finalizado');
    expect(celdas[12]).toBe('Convenio');
    expect(celdas[13]).toBe('2026-09-01');
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
    desde: '2026-01-01',
    hasta: '2026-10-05',
    estado: 'FINALIZADO',
    abogadaId: ABOGADA_ID,
  } as const;

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
      usuariasDistintas: jest.fn().mockResolvedValue(3),
    };
    exportador = {
      tipoContenido: 'application/test',
      extension: 'xlsx',
      generar: jest.fn().mockResolvedValue(Buffer.from('archivo')),
    };
    auditService = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new ReporteProcesosService(
      repositorio,
      exportador,
      auditService as unknown as AuditService,
    );
  });

  it('traduce los filtros: estado y abogada concretos', async () => {
    await service.vistaPrevia(query, contexto);

    expect(repositorio.conteos).toHaveBeenCalledWith({
      desde: '2026-01-01',
      hasta: '2026-10-05',
      estado: 'FINALIZADO',
      abogadaId: ABOGADA_ID,
    });
  });

  it('"Todos" y sin abogada se traducen a null', async () => {
    await service.vistaPrevia(
      { desde: '2026-01-01', hasta: '2026-10-05', estado: 'TODOS' },
      contexto,
    );

    expect(repositorio.conteos).toHaveBeenCalledWith(
      expect.objectContaining({ estado: null, abogadaId: null }),
    );
  });

  it('la vista previa trae totales y audita solo los filtros', async () => {
    const reporte = await service.vistaPrevia(query, contexto);

    expect(reporte.totales).toEqual({ procesos: 4, usuarias: 3 });
    expect(reporte.vistaPrevia).toHaveLength(1);
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REPORTE_CONSULTADO',
        entidad: 'Reporte',
        detalles: {
          reporte: 'PROCESOS_JURIDICOS',
          desde: '2026-01-01',
          hasta: '2026-10-05',
          estado: 'FINALIZADO',
          abogadaId: ABOGADA_ID,
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
});
