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
  textoAvance,
  textoResponsables,
} from './reporte-procesos.service';

// Datos ficticios: nombres, teléfono y lugares inventados.
function proceso(overrides: Partial<FilaProcesoRow> = {}): FilaProcesoRow {
  return {
    numero: 1,
    consecutivo: 2,
    expedienteNumero: '05-2026',
    numeroJudicial: null,
    tipo: 'FIJACION_PENSION_ALIMENTICIA',
    abogada: 'Abogada Ficticia',
    procuradora: null,
    nombres: 'Ana Prueba',
    apellidos: 'Ficticia',
    telefono: '5555-0000',
    edad: 31,
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    departamentoOtro: null,
    municipioOtro: null,
    ubicacionGeografica: 'Aldea Ficticia',
    tipologias: ['FISICA', 'PSICOLOGICA'],
    ultimoAvanceEn: null,
    ultimoAvanceTipo: null,
    ultimoAvanceContenido: null,
    ...overrides,
  };
}

describe('aFilaReporte', () => {
  it('arma la fila con el No. interno del proceso y los datos que registró Trabajo Social', () => {
    expect(aFilaReporte(proceso())).toEqual({
      numero: 1,
      numeroInterno: '05-2026 · Proceso 2',
      usuaria: 'Ana Prueba Ficticia',
      telefono: '5555-0000',
      tipo: 'FIJACION_PENSION_ALIMENTICIA',
      numeroJudicial: null,
      ultimoAvance: null,
      abogada: 'Abogada Ficticia',
      procuradora: null,
      grupoEtnico: expect.any(String) as unknown,
      edad: 31,
      tipologia: 'Física, Psicológica',
      procedencia: 'Aldea Ficticia, Cobán, Alta Verapaz',
    });
  });

  it('el primer proceso del expediente lleva solo el número de expediente', () => {
    expect(aFilaReporte(proceso({ consecutivo: 1 })).numeroInterno).toBe(
      '05-2026',
    );
  });

  it('la procedencia de fuera de Alta Verapaz usa lo escrito a mano y omite lo vacío', () => {
    const fila = aFilaReporte(
      proceso({
        municipio: null,
        departamentoOtro: 'Petén',
        municipioOtro: 'Sayaxché',
        ubicacionGeografica: '  ',
      }),
    );
    expect(fila.procedencia).toBe('Sayaxché, Petén');
  });

  it('la fecha del último avance es la de Guatemala, aunque cruce la medianoche UTC', () => {
    const fila = aFilaReporte(
      proceso({
        // 21/10/2026 20:30 en Guatemala = 22/10/2026 02:30 UTC.
        ultimoAvanceEn: new Date('2026-10-22T02:30:00.000Z'),
        ultimoAvanceTipo: 'Memorial',
        ultimoAvanceContenido: 'Se presentó el memorial',
      }),
    );
    expect(fila.ultimoAvance).toEqual({
      fecha: '2026-10-21',
      tipo: 'Memorial',
      contenido: 'Se presentó el memorial',
    });
  });
});

describe('textoAvance y textoResponsables', () => {
  it('el avance lleva fecha, tipo y contenido; sin avance, vacío', () => {
    expect(
      textoAvance({
        fecha: '2026-10-20',
        tipo: 'Memorial',
        contenido: 'Se presentó',
      }),
    ).toBe('20/10/2026 · Memorial: Se presentó');
    expect(
      textoAvance({ fecha: '2026-10-20', tipo: 'Memorial', contenido: '' }),
    ).toBe('20/10/2026 · Memorial');
    expect(textoAvance(null)).toBe('');
  });

  it('nombra a quien esté asignada, con su cargo', () => {
    expect(
      textoResponsables({
        abogada: 'Abogada Ficticia',
        procuradora: 'Procuradora Ficticia',
      }),
    ).toBe('Abogada Ficticia (abogada), Procuradora Ficticia (procuradora)');
    expect(
      textoResponsables({ abogada: null, procuradora: 'Procuradora Ficticia' }),
    ).toBe('Procuradora Ficticia (procuradora)');
    expect(textoResponsables({ abogada: null, procuradora: null })).toBe('');
  });
});

describe('aFilaHoja', () => {
  it('tiene una celda por columna, en el orden pedido y con vacíos en lugar de null', () => {
    const celdas = aFilaHoja(
      aFilaReporte(
        proceso({
          telefono: null,
          numeroJudicial: 'Juzgado Ficticio 01-2026',
          ultimoAvanceEn: new Date('2026-10-20T16:00:00.000Z'),
          ultimoAvanceTipo: 'Memorial',
          ultimoAvanceContenido: 'Se presentó',
        }),
      ),
    );

    expect(celdas).toHaveLength(COLUMNAS_PROCESOS.length);
    expect(celdas).toEqual([
      1,
      '05-2026 · Proceso 2',
      'Ana Prueba Ficticia',
      '',
      expect.any(String),
      'Juzgado Ficticio 01-2026',
      '20/10/2026 · Memorial: Se presentó',
      'Abogada Ficticia (abogada)',
      expect.any(String),
      31,
      'Física, Psicológica',
      'Aldea Ficticia, Cobán, Alta Verapaz',
    ]);
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
    responsableId: ABOGADA_ID,
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

  it('traduce los filtros: cartera con rango, estado, responsable y tipo concretos', async () => {
    await service.vistaPrevia(query, contexto);

    expect(repositorio.conteos).toHaveBeenCalledWith({
      cartera: 'TODOS',
      anioActual: 2026,
      rango: { desde: '2026-01-01', hasta: '2026-10-05' },
      estado: 'FINALIZADO',
      responsableId: ABOGADA_ID,
      tipo: 'DIVORCIO_MUTUO_ACUERDO',
    });
  });

  it('en "Año en curso" ignora el rango; "Todos", sin responsable y sin tipo se traducen a null', async () => {
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
      responsableId: null,
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
          responsableId: ABOGADA_ID,
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
