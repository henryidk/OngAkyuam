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
    grupoEtnico: 'MAYA',
    municipio: 'COBAN',
    tipologias: ['FISICA'],
    codigoProceso: '01-2026',
    procesoId: 'proceso-1',
    procesoConcluido: false,
    expedienteNumero: '01-2026',
    diagnostico: 'Ansiedad',
    enfoqueTerapeutico: 'Sistémico',
    profesional: 'Psicóloga Ficticia (licenciada)',
    clinica: 'CLINICA_1',
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
      contarCerradosPorMotivo: jest.fn().mockResolvedValue([]),
      listarPsicologas: jest.fn().mockResolvedValue([]),
    };
    citasRepository = {
      buscarAccesoCita: jest.fn(),
      buscarLecturaCita: jest.fn(),
      buscarCitasSolapadas: jest.fn(),
      registrarConsulta: jest.fn(),
      listarCitasEnRango: jest.fn(),
      primerasSesionesAtendidas: jest.fn().mockResolvedValue(new Map()),
      obtenerDetalle: jest.fn(),
      buscarUltimaClinica: jest.fn().mockResolvedValue(null),
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

  const SIN_FILTROS = {
    profesional: 'MIOS',
    estadoProceso: 'TODOS',
    incluirNinos: true,
  } as const;

  const consultar = (filtros: Partial<typeof SIN_FILTROS> | object = {}) =>
    service.obtenerIndicadores(
      { anio: 2026, ...SIN_FILTROS, ...filtros },
      'psicologa-a',
      contexto,
    );

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
          detalles: { anio: 2026, ...SIN_FILTROS },
        }),
      );
    });

    describe('filtros', () => {
      it('"Todo el equipo" no acota a ninguna psicóloga (null) en citas ni en conteos', async () => {
        await consultar({ profesional: 'EQUIPO' });

        expect(
          citasRepository.listarCitasEnRango.mock.calls[0][0].psicologaId,
        ).toBeNull();
        expect(atencionRepository.contarCasosActivos).toHaveBeenCalledWith(
          null,
        );
        expect(atencionRepository.fechaPrimerProceso).toHaveBeenCalledWith(
          null,
        );
      });

      it('con el id de una psicóloga, acota a ella y no a quien consulta', async () => {
        const otra = '5f0c1d7e-8a4b-4c2d-9e1f-0a1b2c3d4e5f';
        await consultar({ profesional: otra });

        expect(
          citasRepository.listarCitasEnRango.mock.calls[0][0].psicologaId,
        ).toBe(otra);
        expect(atencionRepository.contarCasosActivos).toHaveBeenCalledWith(
          otra,
        );
      });

      it('sin hijas e hijos, solo cuenta a las usuarias', async () => {
        citasRepository.listarCitasEnRango.mockResolvedValue([
          crearCitaAgregado(),
          crearCitaAgregado({
            ninoId: 'nino-1',
            fechaNacimiento: '2015-03-01',
          }),
        ]);

        const { anual } = await consultar({ incluirNinos: false });

        expect(anual.personasAtendidas).toBe(1);
        expect(anual.sesionesRealizadas).toBe(1);
      });

      it('por estado del proceso, separa los concluidos de los que siguen en atención', async () => {
        citasRepository.listarCitasEnRango.mockResolvedValue([
          crearCitaAgregado(),
          crearCitaAgregado({
            usuariaId: 'usuaria-2',
            procesoId: 'proceso-2',
            procesoConcluido: true,
          }),
        ]);

        expect(
          (await consultar({ estadoProceso: 'CONCLUIDOS' })).anual
            .personasAtendidas,
        ).toBe(1);
        expect(
          (await consultar({ estadoProceso: 'EN_ATENCION' })).anual
            .personasAtendidas,
        ).toBe(1);
        expect((await consultar()).anual.personasAtendidas).toBe(2);
      });
    });

    it('cuenta las sesiones atendidas por clínica, con "Sin anotar" para las antiguas', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado(),
        crearCitaAgregado({ clinica: 'CLINICA_2' }),
        crearCitaAgregado({ clinica: null }),
        // Una inasistencia no es una sesión en ninguna clínica.
        crearCitaAgregado({ estado: 'NO_ASISTIO', clinica: null }),
      ]);

      const { sesionesPorClinica } = (await consultar()).anual.desgloses;

      expect(total(sesionesPorClinica, 'CLINICA_1')).toBe(1);
      expect(total(sesionesPorClinica, 'CLINICA_2')).toBe(1);
      expect(total(sesionesPorClinica, 'SIN_ANOTAR')).toBe(1);
    });

    it('desglosa los cierres por motivo, con todos los motivos aunque tengan 0', async () => {
      atencionRepository.contarCerradosPorMotivo.mockResolvedValue([
        { motivo: 'OBJETIVOS_CUMPLIDOS', total: 3 },
        { motivo: null, total: 1 },
      ]);

      const { cierresPorMotivo } = await consultar();

      expect(total(cierresPorMotivo, 'OBJETIVOS_CUMPLIDOS')).toBe(3);
      expect(total(cierresPorMotivo, 'DEJO_DE_ASISTIR')).toBe(0);
      expect(total(cierresPorMotivo, 'SIN_ANOTAR')).toBe(1);
    });
  });

  describe('exportar', () => {
    const exportar = (desde = '2026-01-01', hasta = '2026-12-31') =>
      service.exportar(
        { desde, hasta, ...SIN_FILTROS },
        'psicologa-a',
        contexto,
      );

    it('pide solo las citas de la psicóloga que descarga', async () => {
      await exportar();

      expect(citasRepository.listarCitasEnRango).toHaveBeenCalledWith(
        expect.objectContaining({ psicologaId: 'psicologa-a' }),
      );
    });

    it('el rango va del inicio del día "desde" al último instante del día "hasta", en hora de Guatemala', async () => {
      await exportar('2026-03-01', '2026-03-31');

      const params = citasRepository.listarCitasEnRango.mock.calls[0][0];
      // Guatemala es UTC-6 todo el año: la medianoche del 1 de marzo es 06:00 UTC.
      expect(params.desde.toISOString()).toBe('2026-03-01T06:00:00.000Z');
      expect(params.hasta.toISOString()).toBe('2026-04-01T05:59:59.999Z');
    });

    it('columnas en el orden nuevo: "No. expediente", "Estado" y "Responsable"', async () => {
      await exportar();

      const hoja = exportador.generar.mock.calls[0][0];
      expect(hoja.columnas.map((columna) => columna.titulo)).toEqual([
        'No.',
        'Persona',
        'No. expediente',
        'Proceso',
        'Edad',
        'Rango de edad',
        'Grupo étnico',
        'Municipio',
        'Tipología 22-2008',
        'Diagnóstico',
        'Enfoque terapéutico',
        'Semana de atención',
        'Sesiones',
        'Inasistencias',
        'Primera sesión',
        'Última sesión',
        'Estado',
        'Responsable',
      ]);
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
          '01-2026',
          '01-2026',
          36,
          '31 a 60 años',
          'Maya',
          'Cobán',
          'Física',
          'Ansiedad',
          'Sistémico',
          // Sin dato del repositorio cae a la primera sesión del año: 5 de feb 2026 (jueves),
          // el 1 de febrero es domingo → semana 2.
          2,
          2,
          1,
          '2026-02-05',
          '2026-03-05',
          'En atención',
          'Psicóloga Ficticia (licenciada)',
        ],
      ]);
    });

    it('calcula la semana de calendario con la primera sesión del proceso, aunque sea de otro año', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({ procesoConcluido: true }),
      ]);
      // 2025-12-29 15:00 UTC = lunes 29 de dic en GT; el 1 de dic de 2025 fue lunes → semana 5.
      citasRepository.primerasSesionesAtendidas.mockResolvedValue(
        new Map([['proceso-1', new Date('2025-12-29T15:00:00.000Z')]]),
      );

      await exportar();

      expect(citasRepository.primerasSesionesAtendidas).toHaveBeenCalledWith([
        'proceso-1',
      ]);
      const [fila] = exportador.generar.mock.calls[0][0].filas;
      expect(fila[11]).toBe(5);
      expect(fila[16]).toBe('Concluido');
    });

    it('toma diagnóstico, enfoque y estado del proceso más reciente, sin arrastrar los del anterior', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado({
          fechaHora: new Date('2026-02-05T15:00:00.000Z'),
          procesoId: 'proceso-viejo',
          procesoConcluido: true,
          diagnostico: 'Duelo',
        }),
        crearCitaAgregado({
          fechaHora: new Date('2026-08-05T15:00:00.000Z'),
          procesoId: 'proceso-nuevo',
          codigoProceso: '01-2026 · Proceso 2',
          diagnostico: null,
          enfoqueTerapeutico: null,
        }),
      ]);

      await exportar();

      const [fila] = exportador.generar.mock.calls[0][0].filas;
      expect(fila[9]).toBe('');
      expect(fila[10]).toBe('');
      expect(fila[16]).toBe('En atención');
    });

    it('no lleva la columna Ingreso: el ingreso por área vive en la base, no en el Excel', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado(),
      ]);

      await exportar();

      const hoja = exportador.generar.mock.calls[0][0];
      expect(hoja.columnas.map((columna) => columna.titulo)).not.toContain(
        'Ingreso',
      );
    });

    it('audita la descarga con el rango y el número de filas, y nombra el archivo sin datos personales', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado(),
      ]);

      const archivo = await exportar('2026-02-01', '2026-06-30');

      expect(archivo.nombreArchivo).toBe(
        'psicologia-personas-atendidas_2026-02-01_2026-06-30.xlsx',
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'REPORTE_PSICOLOGIA_EXPORTADO',
          detalles: {
            desde: '2026-02-01',
            hasta: '2026-06-30',
            ...SIN_FILTROS,
            filas: 1,
          },
        }),
      );
    });
  });

  describe('listarPersonas', () => {
    const listar = (pagina = 1) =>
      service.listarPersonas(
        { desde: '2026-01-01', hasta: '2026-12-31', ...SIN_FILTROS, pagina },
        'psicologa-a',
        contexto,
      );

    /** `n` personas distintas: una usuaria por expediente. */
    const citasDePersonas = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        crearCitaAgregado({
          usuariaId: `usuaria-${i}`,
          expedienteNumero: `${String(i + 1).padStart(2, '0')}-2026`,
          procesoId: `proceso-${i}`,
        }),
      );

    it('entrega las mismas filas que el Excel, ya como objetos con etiquetas', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado(),
      ]);

      const { filas, total, pagina } = await listar();

      expect(total).toBe(1);
      expect(pagina).toBe(1);
      expect(filas[0]).toEqual(
        expect.objectContaining({
          numero: 1,
          persona: 'Usuaria',
          grupoEtnico: 'Maya',
          municipio: 'Cobán',
          estado: 'En atención',
        }),
      );
    });

    it('pagina de 25 en 25 y numera de forma continua', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue(citasDePersonas(30));

      const { filas, total, pagina } = await listar(2);

      expect(total).toBe(30);
      expect(pagina).toBe(2);
      expect(filas).toHaveLength(5);
      expect(filas[0].numero).toBe(26);
    });

    it('si la página quedó fuera (cambiaron los filtros), entrega la última', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue(citasDePersonas(3));

      const { filas, pagina } = await listar(4);

      expect(pagina).toBe(1);
      expect(filas).toHaveLength(3);
    });

    it('audita rango, filtros, página y total, nunca el contenido de las filas', async () => {
      citasRepository.listarCitasEnRango.mockResolvedValue([
        crearCitaAgregado(),
      ]);

      await listar();

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'PERSONAS_ATENDIDAS_PSICOLOGIA_CONSULTADAS',
          detalles: {
            desde: '2026-01-01',
            hasta: '2026-12-31',
            ...SIN_FILTROS,
            pagina: 1,
            total: 1,
          },
        }),
      );
    });
  });
});
