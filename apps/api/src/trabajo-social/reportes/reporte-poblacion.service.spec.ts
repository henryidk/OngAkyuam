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
    usuariaNueva: true,
    nombres: 'Ana Prueba',
    apellidos: 'Ficticia',
    dpi: '0000000000000',
    fechaNacimiento: '1995-03-02',
    edad: 31,
    generoNino: null,
    grupoEtnico: 'MAYA',
    municipio: 'COBAN',
    departamentoOtro: null,
    municipioOtro: null,
    ubicacionGeografica: 'Zona 1',
    telefono: '00000000',
    areaResidencia: 'RURAL',
    ocupacion: 'Ama de casa',
    condicionMaternidad: 'LACTANTE',
    idiomaAtencion: 'QEQCHI',
    atendidaPorNombre: 'Trabajadora Ficticia',
    atendidaPorPuesto: 'PRACTICANTE',
    sede: 'TACTIC',
    areasMarcadas: ['JURIDICO', 'MEDICA'],
    motivoReferencia: '  Orientación legal  ',
    accionesTrabajoSocial: [
      { fecha: '2026-09-12', texto: 'Seguimiento telefónico' },
      { fecha: '2026-09-10', texto: 'Entrevista inicial' },
    ],
    procesosJuridicos: [
      'DIVORCIO_MUTUO_ACUERDO',
      'FIJACION_PENSION_ALIMENTICIA',
    ],
    atencionesPsicologicas: [],
    // 02:30 UTC del 11 = 20:30 del 10 en Guatemala: la fecha del resumen es la de Guatemala.
    atencionesMedicas: [
      { fechaHora: '2026-09-11T02:30:00.000Z', texto: 'Consulta general' },
    ],
    ...overrides,
  };
}

function nino(overrides: Partial<FilaPoblacionRow> = {}): FilaPoblacionRow {
  return usuaria({
    numero: 2,
    esUsuaria: false,
    nombres: 'Luz Prueba',
    dpi: null,
    telefono: null,
    ocupacion: null,
    condicionMaternidad: null,
    fechaNacimiento: '2019-05-20',
    edad: 7,
    generoNino: 'MUJER',
    areasMarcadas: [],
    motivoReferencia: null,
    accionesTrabajoSocial: [],
    procesosJuridicos: [],
    atencionesMedicas: [],
    ...overrides,
  });
}

describe('aFilaPoblacion', () => {
  it('arma la fila de la usuaria con etiquetas completas', () => {
    expect(aFilaPoblacion(usuaria())).toEqual({
      numero: 1,
      fecha: '2026-09-10',
      departamento: 'Alta Verapaz',
      oficinaResponsable: 'Tactic',
      municipio: 'Cobán',
      numeroCaso: '07-2026',
      fechaNacimiento: '1995-03-02',
      edad: 31,
      rangoEdad: '31 a 60 años',
      nombresApellidos: 'Ana Prueba Ficticia',
      dpi: '0000000000000',
      telefono: '00000000',
      genero: 'M',
      grupoEtnico: 'Maya',
      ubicacionGeografica: 'Zona 1',
      tipologia: 'Física, Psicológica',
      areaResidencia: 'Rural',
      condicionMaternidad: 'LACTANTE',
      ocupacion: 'Ama de casa',
      idiomaAtencion: "Q'eqchi'",
      derivadaAlbergue: true,
      atendidaPor: 'Trabajadora Ficticia (practicante)',
      descripcionReferencia: 'Orientación legal',
      atencionTrabajoSocial:
        '10/09/2026: Entrevista inicial; 12/09/2026: Seguimiento telefónico',
      referidaJuridico: true,
      referidaPsicologia: false,
      referidaMedica: true,
      procesoRequerido:
        'Juicio Oral de Divorcio por Mutuo Acuerdo, Juicio Oral de Fijación de Pensión Alimenticia',
      atencionPsicologica: '',
      atencionMedica: '10/09/2026: Consulta general',
      usuariaNueva: true,
      esUsuaria: true,
    });
  });

  it('la hija hereda del caso lugar, idioma, oficina y quién atendió, sin lo propio de la usuaria', () => {
    const fila = aFilaPoblacion(nino());

    expect(fila).toMatchObject({
      departamento: 'Alta Verapaz',
      municipio: 'Cobán',
      grupoEtnico: 'Maya',
      ubicacionGeografica: 'Zona 1',
      areaResidencia: 'Rural',
      idiomaAtencion: "Q'eqchi'",
      oficinaResponsable: 'Tactic',
      atendidaPor: 'Trabajadora Ficticia (practicante)',
      derivadaAlbergue: true,
      genero: 'M',
      tipologia: '',
      dpi: null,
      telefono: null,
      ocupacion: '',
      condicionMaternidad: null,
      descripcionReferencia: '',
      atencionTrabajoSocial: '',
      referidaJuridico: false,
      procesoRequerido: '',
      esUsuaria: false,
    });
  });

  it('la hija atendida en Psicología y Medicina lleva sus X, el motivo y su propia atención', () => {
    const fila = aFilaPoblacion(
      nino({
        areasMarcadas: ['PSICOLOGIA', 'MEDICA'],
        motivoReferencia: 'Acompañamiento a la familia',
        atencionesPsicologicas: [
          { fechaHora: '2026-09-12T16:00:00.000Z', texto: 'Juego terapéutico' },
        ],
        atencionesMedicas: [
          {
            fechaHora: '2026-09-11T02:30:00.000Z',
            texto: 'Control de niña sana',
          },
        ],
      }),
    );

    expect(fila).toMatchObject({
      referidaJuridico: false,
      referidaPsicologia: true,
      referidaMedica: true,
      descripcionReferencia: 'Acompañamiento a la familia',
      atencionPsicologica: '12/09/2026: Juego terapéutico',
      atencionMedica: '10/09/2026: Control de niña sana',
      // Lo que es del caso de la usuaria sigue vacío.
      atencionTrabajoSocial: '',
      procesoRequerido: '',
      tipologia: '',
    });
  });

  it('un niño sale con género H', () => {
    expect(aFilaPoblacion(nino({ generoNino: 'HOMBRE' })).genero).toBe('H');
  });

  it('quien no es practicante sale solo con su nombre', () => {
    expect(
      aFilaPoblacion(usuaria({ atendidaPorPuesto: 'TRABAJADORA_SOCIAL' }))
        .atendidaPor,
    ).toBe('Trabajadora Ficticia');
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
  const celda = (celdas: unknown[], titulo: string) =>
    celdas[COLUMNAS_POBLACION.findIndex((c) => c.titulo === titulo)];

  it('tiene una celda por columna, marca con X y deja el DPI como texto', () => {
    const celdas = aFilaHoja(aFilaPoblacion(usuaria()));

    expect(celdas).toHaveLength(COLUMNAS_POBLACION.length);
    expect(celda(celdas, 'DPI')).toBe('0000000000000');
    expect(celda(celdas, 'Gestante')).toBe('');
    expect(celda(celdas, 'Lactante')).toBe('X');
    expect(celda(celdas, 'Normal')).toBe('');
    expect(celda(celdas, 'Derivada a albergue')).toBe('Sí');
    expect(celda(celdas, 'Legal')).toBe('X');
    expect(celda(celdas, 'Psicológica')).toBe('');
    expect(celda(celdas, 'Médica')).toBe('X');
    expect(celda(celdas, 'Usuaria nueva')).toBe('Sí');
  });

  it('una usuaria que ya venía de antes sale "No" en Usuaria nueva, y su hija igual', () => {
    expect(
      celda(
        aFilaHoja(aFilaPoblacion(usuaria({ usuariaNueva: false }))),
        'Usuaria nueva',
      ),
    ).toBe('No');
    expect(
      celda(
        aFilaHoja(aFilaPoblacion(nino({ usuariaNueva: false }))),
        'Usuaria nueva',
      ),
    ).toBe('No');
  });

  it('la fila de una hija no marca ninguna condición de maternidad', () => {
    const celdas = aFilaHoja(aFilaPoblacion(nino({ tipoRegistro: 'EXTERNA' })));

    expect(celda(celdas, 'Gestante')).toBe('');
    expect(celda(celdas, 'Lactante')).toBe('');
    expect(celda(celdas, 'Normal')).toBe('');
    expect(celda(celdas, 'Derivada a albergue')).toBe('No');
  });

  it('los grupos de encabezado siguen el formato de la ONG', () => {
    const grupos = COLUMNAS_POBLACION.map((c) => c.grupo ?? null);

    expect(COLUMNAS_POBLACION).toHaveLength(33);
    expect(grupos.slice(0, 16).every((g) => g === null)).toBe(true);
    expect(new Set(grupos.slice(16, 26))).toEqual(new Set(['Área social']));
    expect(new Set(grupos.slice(26, 29))).toEqual(
      new Set(['Referida al área']),
    );
    expect(new Set(grupos.slice(29, 32))).toEqual(
      new Set(['Áreas de atención']),
    );
    // "Usuaria nueva" va al final, fuera de los grupos, para no mover el formato de la ONG.
    expect(COLUMNAS_POBLACION.at(-1)).toEqual(
      expect.objectContaining({ titulo: 'Usuaria nueva' }),
    );
    expect(grupos.at(-1)).toBeNull();
  });
});

describe('armarDesgloses', () => {
  it('agrupa las edades por rango y separa usuarias de hijas/hijos', () => {
    const resultado = armarDesgloses(
      [
        { esUsuaria: true, edad: 31, grupoEtnico: 'LADINO', total: 2 },
        { esUsuaria: true, edad: 20, grupoEtnico: 'MAYA', total: 1 },
        { esUsuaria: false, edad: 5, grupoEtnico: 'MAYA', total: 3 },
        { esUsuaria: false, edad: 13, grupoEtnico: 'LADINO', total: 1 },
      ],
      [{ tipologia: 'FISICA', total: 3 }],
      2,
    );

    expect(resultado.totales).toEqual({
      personas: 7,
      usuarias: 3,
      ninos: 4,
      usuariasNuevas: 2,
    });
    expect(
      resultado.desgloses.rangoEdad.map((c) => [c.clave, c.total]),
    ).toEqual([
      ['0-13', 4],
      ['14-30', 1],
      ['31-60', 2],
      ['MAYOR_60', 0],
    ]);
    expect(
      resultado.desgloses.grupoEtnico.find((c) => c.clave === 'MAYA'),
    ).toEqual({ clave: 'MAYA', etiqueta: 'Maya', total: 4 });
  });

  it('muestra todas las categorías del catálogo aunque estén en 0', () => {
    const resultado = armarDesgloses([], [], 0);

    expect(resultado.totales).toEqual({
      personas: 0,
      usuarias: 0,
      ninos: 0,
      usuariasNuevas: 0,
    });
    expect(resultado.desgloses.grupoEtnico).toHaveLength(5);
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
    soloNuevas: false,
  };

  beforeEach(() => {
    repositorio = {
      filas: jest.fn().mockResolvedValue([usuaria(), nino()]),
      conteosDemograficos: jest.fn().mockResolvedValue([]),
      conteosTipologia: jest.fn().mockResolvedValue([]),
      contarUsuariasNuevas: jest.fn().mockResolvedValue(1),
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
        soloNuevas: false,
      },
      20,
    );
  });

  it('pasa "Solo usuarias nuevas" al repositorio y devuelve el total de nuevas', async () => {
    const reporte = await service.vistaPrevia(
      { ...query, soloNuevas: true },
      contexto,
    );

    expect(repositorio.contarUsuariasNuevas).toHaveBeenCalledWith(
      expect.objectContaining({ soloNuevas: true }),
    );
    expect(repositorio.filas).toHaveBeenCalledWith(
      expect.objectContaining({ soloNuevas: true }),
      20,
    );
    expect(reporte.totales.usuariasNuevas).toBe(1);
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
          soloNuevas: false,
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
