/* eslint-disable @typescript-eslint/unbound-method */
import type { AuditService } from '../../auth/services/audit.service';
import type { IExportadorHojaCalculo } from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type {
  FilaPoblacionRow,
  IReportePoblacionRepository,
} from './interfaces/reporte-poblacion-repository.interface';
import {
  aFilaHoja,
  aFilaPoblacion,
  armarDesgloses,
  COLUMNAS_POBLACION,
  ReportePoblacionService,
} from './reporte-poblacion.service';

// Datos ficticios: nombres inventados y DPI inválido a propósito (plan §6).
function usuaria(overrides: Partial<FilaPoblacionRow> = {}): FilaPoblacionRow {
  return {
    numero: 1,
    fecha: '2026-09-10',
    numeroCaso: '07-2026',
    tipoRegistro: 'INTERNA',
    tipologias: ['FISICA', 'PSICOLOGICA'],
    esUsuaria: true,
    nombres: 'Ana Prueba',
    apellidos: 'Ficticia',
    dpi: '0000000000000',
    fechaNacimiento: '1995-03-02',
    edad: 31,
    generoNino: null,
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    departamentoOtro: null,
    municipioOtro: null,
    ubicacionGeografica: 'Zona 1',
    ...overrides,
  };
}

function nino(overrides: Partial<FilaPoblacionRow> = {}): FilaPoblacionRow {
  return usuaria({
    numero: 2,
    esUsuaria: false,
    nombres: 'Luz Prueba',
    dpi: null,
    fechaNacimiento: '2019-05-20',
    edad: 7,
    generoNino: 'MUJER',
    ...overrides,
  });
}

describe('aFilaPoblacion', () => {
  it('arma la fila de la usuaria con etiquetas completas', () => {
    expect(aFilaPoblacion(usuaria())).toEqual({
      numero: 1,
      fecha: '2026-09-10',
      departamento: 'Alta Verapaz',
      municipio: 'Cobán',
      numeroCaso: '07-2026',
      fechaNacimiento: '1995-03-02',
      edad: 31,
      rangoEdad: '31 a 60 años',
      nombresApellidos: 'Ana Prueba Ficticia',
      dpi: '0000000000000',
      genero: 'Mujer',
      grupoEtnico: "Maya Q'eqchi'",
      ubicacionGeografica: 'Zona 1',
      tipologia: 'Física, Psicológica',
      registro: 'INTERNA',
      relacion: 'Usuaria',
      esUsuaria: true,
    });
  });

  it('la hija hereda lugar y grupo étnico de la madre, sin tipología ni DPI', () => {
    const fila = aFilaPoblacion(nino());

    expect(fila).toMatchObject({
      departamento: 'Alta Verapaz',
      municipio: 'Cobán',
      grupoEtnico: "Maya Q'eqchi'",
      ubicacionGeografica: 'Zona 1',
      genero: 'Niña',
      relacion: 'Hija de 07-2026',
      tipologia: '',
      dpi: null,
    });
  });

  it('distingue Hijo/Niño por el género del niño', () => {
    expect(aFilaPoblacion(nino({ generoNino: 'HOMBRE' }))).toMatchObject({
      genero: 'Niño',
      relacion: 'Hijo de 07-2026',
    });
  });

  it('usa el rango de edad que corresponde a la edad a la fecha del caso', () => {
    // El repositorio calcula la edad a la fecha del caso; 13 años sigue en el rango 0-13 aunque
    // hoy ya tenga 14.
    expect(aFilaPoblacion(nino({ edad: 13 })).rangoEdad).toBe('0 a 13 años');
    expect(aFilaPoblacion(usuaria({ edad: 14 })).rangoEdad).toBe(
      '14 a 30 años',
    );
    expect(aFilaPoblacion(usuaria({ edad: 61 })).rangoEdad).toBe(
      'Mayor de 60 años',
    );
  });

  it('fuera de Alta Verapaz usa el departamento y municipio escritos a mano', () => {
    const fila = aFilaPoblacion(
      usuaria({
        municipio: null,
        departamentoOtro: 'Petén',
        municipioOtro: 'Sayaxché',
        ubicacionGeografica: null,
      }),
    );

    expect(fila.departamento).toBe('Petén');
    expect(fila.municipio).toBe('Sayaxché');
    expect(fila.ubicacionGeografica).toBe('');
  });
});

describe('aFilaHoja', () => {
  it('tiene una celda por columna y usa la etiqueta corta del registro', () => {
    const celdas = aFilaHoja(aFilaPoblacion(usuaria()));

    expect(celdas).toHaveLength(COLUMNAS_POBLACION.length);
    expect(
      celdas[COLUMNAS_POBLACION.findIndex((c) => c.titulo === 'Registro')],
    ).toBe('Interna');
    expect(
      celdas[COLUMNAS_POBLACION.findIndex((c) => c.titulo === 'DPI')],
    ).toBe('0000000000000');
  });
});

describe('armarDesgloses', () => {
  it('agrupa las edades por rango y separa usuarias de hijas/hijos', () => {
    const resultado = armarDesgloses(
      [
        { esUsuaria: true, edad: 31, grupoEtnico: 'LADINO', total: 2 },
        { esUsuaria: true, edad: 20, grupoEtnico: 'MAYA_QECHI', total: 1 },
        { esUsuaria: false, edad: 5, grupoEtnico: 'MAYA_QECHI', total: 3 },
        { esUsuaria: false, edad: 13, grupoEtnico: 'LADINO', total: 1 },
      ],
      [{ tipologia: 'FISICA', total: 3 }],
    );

    expect(resultado.totales).toEqual({ personas: 7, usuarias: 3, ninos: 4 });
    expect(
      resultado.desgloses.rangoEdad.map((c) => [c.clave, c.total]),
    ).toEqual([
      ['0-13', 4],
      ['14-30', 1],
      ['31-60', 2],
      ['MAYOR_60', 0],
    ]);
    expect(
      resultado.desgloses.grupoEtnico.find((c) => c.clave === 'MAYA_QECHI'),
    ).toEqual({ clave: 'MAYA_QECHI', etiqueta: "Maya Q'eqchi'", total: 4 });
  });

  it('muestra todas las categorías del catálogo aunque estén en 0', () => {
    const resultado = armarDesgloses([], []);

    expect(resultado.totales).toEqual({ personas: 0, usuarias: 0, ninos: 0 });
    expect(resultado.desgloses.grupoEtnico).toHaveLength(6);
    expect(resultado.desgloses.tipologia.map((c) => c.total)).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe('ReportePoblacionService', () => {
  let service: ReportePoblacionService;
  let repositorio: jest.Mocked<IReportePoblacionRepository>;
  let exportador: jest.Mocked<IExportadorHojaCalculo>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
  const query = {
    desde: '2026-09-01',
    hasta: '2026-09-30',
    tipoRegistro: 'TODOS' as const,
    incluirNinos: true,
  };

  beforeEach(() => {
    repositorio = {
      filas: jest.fn().mockResolvedValue([usuaria(), nino()]),
      conteosDemograficos: jest.fn().mockResolvedValue([]),
      conteosTipologia: jest.fn().mockResolvedValue([]),
    };
    exportador = {
      tipoContenido: 'application/test',
      extension: 'xlsx',
      generar: jest.fn().mockResolvedValue(Buffer.from('xlsx')),
    };
    auditService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;
    service = new ReportePoblacionService(
      repositorio,
      exportador,
      auditService,
    );
  });

  it('"TODOS" se traduce a sin filtro de registro y la vista previa pide 20 filas', async () => {
    await service.vistaPrevia(query, contexto);

    expect(repositorio.filas).toHaveBeenCalledWith(
      {
        desde: '2026-09-01',
        hasta: '2026-09-30',
        tipoRegistro: null,
        incluirNinos: true,
      },
      20,
    );
  });

  it('la exportación pide todas las filas y genera una fila de hoja por persona', async () => {
    const archivo = await service.exportar(
      { ...query, tipoRegistro: 'INTERNA' },
      contexto,
    );

    expect(repositorio.filas).toHaveBeenCalledWith(
      expect.objectContaining({ tipoRegistro: 'INTERNA' }),
      null,
    );
    const hoja = exportador.generar.mock.calls[0][0];
    expect(hoja.columnas).toBe(COLUMNAS_POBLACION);
    expect(hoja.filas).toHaveLength(2);
    expect(archivo.nombreArchivo).toBe(
      'poblacion-beneficiada_2026-09-01_2026-09-30.xlsx',
    );
  });

  it('audita la exportación solo con filtros, nunca con datos de personas', async () => {
    await service.exportar(query, contexto);

    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REPORTE_EXPORTADO',
        entidad: 'Reporte',
        detalles: {
          reporte: 'POBLACION_BENEFICIADA',
          desde: '2026-09-01',
          hasta: '2026-09-30',
          tipoRegistro: 'TODOS',
          incluirNinos: true,
          filas: 2,
        },
      }),
    );
    const detalles = JSON.stringify(auditService.registrar.mock.calls);
    expect(detalles).not.toContain('Ana Prueba');
    expect(detalles).not.toContain('0000000000000');
  });

  it('audita la vista previa (muestra nombres y DPI) sin datos de personas', async () => {
    await service.vistaPrevia(query, contexto);

    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'REPORTE_CONSULTADO' }),
    );
    expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
      'Ana Prueba',
    );
  });

  it('no audita la exportación si falla la generación del archivo', async () => {
    exportador.generar.mockRejectedValue(new Error('fallo'));

    await expect(service.exportar(query, contexto)).rejects.toThrow('fallo');
    expect(auditService.registrar).not.toHaveBeenCalled();
  });
});
