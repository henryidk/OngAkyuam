/* eslint-disable @typescript-eslint/unbound-method */
import type { AuditService } from '../../auth/services/audit.service';
import type { IExportadorHojaCalculo } from '../../common/hoja-calculo/exportador-hoja-calculo.interface';
import type {
  FilaPoblacionJuridicoRow,
  IReportePoblacionJuridicoRepository,
} from '../interfaces/reporte-poblacion-juridico-repository.interface';
import { contexto, relojFijo } from '../pruebas/dobles';
import {
  aFilaHojaPoblacion,
  aFilaPoblacionJuridico,
  COLUMNAS_POBLACION_JURIDICO,
  ReportePoblacionJuridicoService,
} from './reporte-poblacion-juridico.service';

// Datos ficticios: nombres y DPI inventados.
function expediente(
  overrides: Partial<FilaPoblacionJuridicoRow> = {},
): FilaPoblacionJuridicoRow {
  return {
    numero: 1,
    dia: '2026-03-02',
    numeroCaso: '05-2026',
    nombres: 'Ana Prueba',
    apellidos: 'Ficticia',
    dpi: '0000000000000',
    fechaNacimiento: '1995-04-10',
    edad: 30,
    grupoEtnico: 'MAYA_QECHI',
    municipio: 'COBAN',
    departamentoOtro: null,
    municipioOtro: null,
    ubicacionGeografica: 'Barrio Ficticio',
    tipologias: ['FISICA', 'PSICOLOGICA'],
    ...overrides,
  };
}

describe('aFilaPoblacionJuridico', () => {
  it('arma las 13 columnas con las etiquetas del formato de la ONG', () => {
    expect(aFilaPoblacionJuridico(expediente())).toEqual({
      numero: 1,
      dia: '2026-03-02',
      departamento: 'Alta Verapaz',
      municipio: 'Cobán',
      numeroCaso: '05-2026',
      fechaNacimiento: '1995-04-10',
      edad: 30,
      nombreApellido: 'Ana Prueba Ficticia',
      dpi: '0000000000000',
      rangoEdad: '14 a 30 años',
      grupoEtnico: "Maya Q'eqchi'",
      ubicacionGeografica: 'Barrio Ficticio',
      tipologia: 'Física, Psicológica',
    });
  });

  it('fuera de Alta Verapaz usa el departamento y municipio escritos a mano', () => {
    const fila = aFilaPoblacionJuridico(
      expediente({
        municipio: null,
        departamentoOtro: 'Guatemala',
        municipioOtro: 'Mixco',
      }),
    );
    expect(fila).toMatchObject({
      departamento: 'Guatemala',
      municipio: 'Mixco',
    });
  });
});

describe('aFilaHojaPoblacion', () => {
  it('tiene una celda por columna; el DPI va como texto y sin DPI queda vacío', () => {
    const conDpi = aFilaHojaPoblacion(aFilaPoblacionJuridico(expediente()));
    const sinDpi = aFilaHojaPoblacion(
      aFilaPoblacionJuridico(
        expediente({ dpi: null, ubicacionGeografica: null }),
      ),
    );

    expect(COLUMNAS_POBLACION_JURIDICO).toHaveLength(13);
    expect(conDpi).toHaveLength(COLUMNAS_POBLACION_JURIDICO.length);
    expect(conDpi[8]).toBe('0000000000000');
    expect(sinDpi[8]).toBe('');
    expect(sinDpi[11]).toBe('');
  });
});

describe('ReportePoblacionJuridicoService', () => {
  let repositorio: jest.Mocked<IReportePoblacionJuridicoRepository>;
  let exportador: jest.Mocked<IExportadorHojaCalculo>;
  let auditService: jest.Mocked<Pick<AuditService, 'registrar'>>;

  function crearServicio(ahora?: Date) {
    return new ReportePoblacionJuridicoService(
      repositorio,
      exportador,
      auditService as unknown as AuditService,
      relojFijo(ahora),
    );
  }

  beforeEach(() => {
    repositorio = {
      filas: jest.fn().mockResolvedValue([expediente()]),
      totales: jest.fn().mockResolvedValue({ expedientes: 4, usuarias: 3 }),
    };
    exportador = {
      tipoContenido: 'application/test',
      extension: 'xlsx',
      generar: jest.fn().mockResolvedValue(Buffer.from('archivo')),
    };
    auditService = { registrar: jest.fn().mockResolvedValue(undefined) };
  });

  it('la vista previa trae totales y filas, y audita solo los filtros', async () => {
    const reporte = await crearServicio().vistaPrevia(
      { cartera: 'SEGUIMIENTO' },
      contexto,
    );

    expect(repositorio.totales).toHaveBeenCalledWith({
      cartera: 'SEGUIMIENTO',
      anioActual: 2026,
      rango: null,
    });
    expect(reporte.totales).toEqual({ expedientes: 4, usuarias: 3 });
    expect(reporte.vistaPrevia).toHaveLength(1);
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REPORTE_CONSULTADO',
        detalles: {
          reporte: 'POBLACION_JURIDICO',
          cartera: 'SEGUIMIENTO',
          anio: 2026,
          desde: null,
          hasta: null,
        },
      }),
    );
    const auditado = JSON.stringify(auditService.registrar.mock.calls);
    expect(auditado).not.toContain('Ana Prueba');
    expect(auditado).not.toContain('0000000000000');
  });

  it('el año en curso es el de Guatemala, no el de UTC', async () => {
    // 01/01/2027 03:00 UTC = 31/12/2026 21:00 en Guatemala.
    await crearServicio(new Date('2027-01-01T03:00:00.000Z')).vistaPrevia(
      { cartera: 'ANIO' },
      contexto,
    );

    expect(repositorio.totales).toHaveBeenCalledWith(
      expect.objectContaining({ anioActual: 2026 }),
    );
  });

  it('el Excel trae todas las filas, audita el export y el nombre no lleva datos personales', async () => {
    const archivo = await crearServicio().exportar(
      { cartera: 'TODOS', desde: '2026-01-01', hasta: '2026-06-30' },
      contexto,
    );

    expect(repositorio.filas).toHaveBeenCalledWith(
      expect.objectContaining({
        rango: { desde: '2026-01-01', hasta: '2026-06-30' },
      }),
      null,
    );
    expect(exportador.generar).toHaveBeenCalledWith(
      expect.objectContaining({ nombreHoja: 'Población beneficiada' }),
    );
    expect(archivo.nombreArchivo).toBe(
      'poblacion-beneficiada-juridico_2026-01-01_2026-06-30.xlsx',
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REPORTE_JURIDICO_EXPORTADO',
        detalles: expect.objectContaining({ filas: 1 }) as unknown,
      }),
    );
  });
});
