import type { INestApplication } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type {
  FilaPoblacionBeneficiada,
  ReportePoblacionBeneficiada,
} from '@akyuam/shared';
import { Workbook } from 'exceljs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  crearApp,
  crearExpediente,
  crearNino,
  crearUsuario,
  sesionDe,
  numeroExpedienteFicticio,
} from './fixtures';

/**
 * Reportes de la etapa 3:
 *  · Trabajo Social: "Usuaria nueva" = la fecha de su primer expediente (de todos) cae en el rango.
 *    Queda registrado en la respuesta (fila, total y filtro), pero no va en el Excel.
 *  · Psicología: el Excel de personas atendidas va por rango desde/hasta y solo con mis procesos.
 * Cada prueba usa un año ficticio propio (209x) y compara contra el reporte de antes de crear
 * sus datos, para no depender de otras suites ni de corridas anteriores sobre la misma base.
 */
describe('Reportes: usuarias nuevas (TS) y rango del Excel de Psicología (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ts: Usuario;
  let psicologa: Usuario;
  let otraPsicologa: Usuario;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    ts = await crearUsuario(prisma, 'TRABAJO_SOCIAL');
    psicologa = await crearUsuario(prisma, 'PSICOLOGIA');
    otraPsicologa = await crearUsuario(prisma, 'PSICOLOGIA');
  });

  afterAll(async () => {
    await app.close();
  });

  /** Mueve el expediente del fixture a la fecha de calendario dada. */
  async function fechar(expedienteId: string, fecha: string) {
    await prisma.expediente.update({
      where: { id: expedienteId },
      data: { fecha: new Date(fecha) },
    });
  }

  /** Otro expediente de la misma usuaria, en la fecha dada. */
  function otroExpediente(usuariaId: string, fecha: string) {
    return prisma.expediente.create({
      data: {
        condicionMaternidad: 'NORMAL',
        idiomaAtencion: 'QEQCHI',
        numero: numeroExpedienteFicticio(),
        usuariaId,
        fecha: new Date(fecha),
        tipoRegistro: 'EXTERNA',
        tipologiaDelito: ['PSICOLOGICA'],
        creadoPorId: ts.id,
      },
    });
  }

  async function reporteTs(query: Record<string, string>) {
    const sesion = sesionDe(app, ts);
    const respuesta = await request(app.getHttpServer())
      .get('/api/trabajo-social/reportes/poblacion-beneficiada')
      .query(query)
      .set('Cookie', sesion.cookie);
    expect(respuesta.status).toBe(200);
    return respuesta.body as ReportePoblacionBeneficiada;
  }

  function filaDe(
    reporte: ReportePoblacionBeneficiada,
    numeroCaso: string,
  ): FilaPoblacionBeneficiada | undefined {
    return reporte.vistaPrevia.find(
      (fila) => fila.numeroCaso === numeroCaso && fila.esUsuaria,
    );
  }

  describe('Trabajo Social · usuarias nuevas', () => {
    it('una usuaria con su primer expediente en 2090 no sale nueva en 2091, aunque tenga otro caso ahí', async () => {
      const rango = { desde: '2091-01-01', hasta: '2091-12-31' };
      const antes = await reporteTs(rango);
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      await fechar(expediente.id, '2090-12-31');
      const segundo = await otroExpediente(usuaria.id, '2091-01-01');

      const reporte = await reporteTs(rango);

      expect(filaDe(reporte, segundo.numero)?.usuariaNueva).toBe(false);
      expect(reporte.totales.usuariasNuevas).toBe(antes.totales.usuariasNuevas);
    });

    it('cuenta el primer y el último día del rango, y deja fuera el día anterior', async () => {
      const antesTodo = await reporteTs({
        desde: '2092-01-01',
        hasta: '2092-12-31',
      });
      const antesSinPrimerDia = await reporteTs({
        desde: '2092-01-02',
        hasta: '2092-12-31',
      });
      const primera = await crearExpediente(prisma, ts.id, []);
      await fechar(primera.expediente.id, '2092-01-01');
      const ultima = await crearExpediente(prisma, ts.id, []);
      await fechar(ultima.expediente.id, '2092-12-31');

      const todoElAnio = await reporteTs({
        desde: '2092-01-01',
        hasta: '2092-12-31',
      });
      expect(filaDe(todoElAnio, primera.expediente.numero)?.usuariaNueva).toBe(
        true,
      );
      expect(filaDe(todoElAnio, ultima.expediente.numero)?.usuariaNueva).toBe(
        true,
      );
      expect(todoElAnio.totales.usuariasNuevas).toBe(
        antesTodo.totales.usuariasNuevas + 2,
      );

      // Desde el 2 de enero, el caso del 1 de enero ya no está en el reporte.
      const sinElPrimerDia = await reporteTs({
        desde: '2092-01-02',
        hasta: '2092-12-31',
      });
      expect(filaDe(sinElPrimerDia, primera.expediente.numero)).toBeUndefined();
      expect(sinElPrimerDia.totales.usuariasNuevas).toBe(
        antesSinPrimerDia.totales.usuariasNuevas + 1,
      );
    });

    it('una usuaria nueva con dos casos en el periodo cuenta una sola vez, y su hija hereda el valor', async () => {
      const rango = { desde: '2093-01-01', hasta: '2093-12-31' };
      const antes = await reporteTs(rango);
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      await fechar(expediente.id, '2093-02-01');
      await otroExpediente(usuaria.id, '2093-03-01');
      await crearNino(prisma, expediente.id);

      const reporte = await reporteTs(rango);

      // Dos filas de usuaria (una por caso), pero una sola usuaria nueva.
      expect(reporte.totales.usuarias).toBe(antes.totales.usuarias + 2);
      expect(reporte.totales.usuariasNuevas).toBe(
        antes.totales.usuariasNuevas + 1,
      );
      const hija = reporte.vistaPrevia.find(
        (fila) => fila.numeroCaso === expediente.numero && !fila.esUsuaria,
      );
      expect(hija?.usuariaNueva).toBe(true);
    });

    it('"Solo usuarias nuevas" deja fuera los casos de quien ya venía de antes', async () => {
      const rango = {
        desde: '2094-01-01',
        hasta: '2094-12-31',
        soloNuevas: 'true',
      };
      const antes = await reporteTs(rango);
      const antigua = await crearExpediente(prisma, ts.id, []);
      await fechar(antigua.expediente.id, '2093-12-31');
      const casoActual = await otroExpediente(antigua.usuaria.id, '2094-05-01');
      const nueva = await crearExpediente(prisma, ts.id, []);
      await fechar(nueva.expediente.id, '2094-06-01');

      const reporte = await reporteTs(rango);

      expect(filaDe(reporte, casoActual.numero)).toBeUndefined();
      expect(filaDe(reporte, nueva.expediente.numero)?.usuariaNueva).toBe(true);
      expect(reporte.totales.usuarias).toBe(antes.totales.usuarias + 1);
    });

    it('el Excel no lleva la columna "Usuaria nueva": el dato solo queda registrado', async () => {
      const { expediente } = await crearExpediente(prisma, ts.id, []);
      await fechar(expediente.id, '2095-04-04');
      const sesion = sesionDe(app, ts);

      const respuesta = await request(app.getHttpServer())
        .get('/api/trabajo-social/reportes/poblacion-beneficiada.xlsx')
        .query({ desde: '2095-01-01', hasta: '2095-12-31' })
        .set('Cookie', sesion.cookie)
        .buffer(true)
        .parse((res, callback) => {
          const partes: Buffer[] = [];
          res.on('data', (parte: Buffer) => partes.push(parte));
          res.on('end', () => callback(null, Buffer.concat(partes)));
        });

      expect(respuesta.status).toBe(200);
      const libro = new Workbook();
      await libro.xlsx.load(
        respuesta.body as Parameters<typeof libro.xlsx.load>[0],
      );
      const hoja = libro.worksheets[0];
      const encabezados = encabezadosDe(hoja, 'Médica: atención brindada');
      expect(encabezados.at(-1)).toBe('Médica: atención brindada');
      expect(encabezados).not.toContain('Usuaria nueva');
    });

    it('otra área no puede pedir el reporte de Trabajo Social', async () => {
      const sesion = sesionDe(app, psicologa);

      const respuesta = await request(app.getHttpServer())
        .get('/api/trabajo-social/reportes/poblacion-beneficiada')
        .query({ desde: '2091-01-01', hasta: '2091-12-31' })
        .set('Cookie', sesion.cookie);

      expect(respuesta.status).toBe(403);
    });
  });

  describe('Psicología · rango del Excel', () => {
    /** Proceso de la psicóloga con una sesión atendida en el instante dado. */
    async function sesionAtendida(profesional: Usuario, fechaHora: string) {
      const { expediente } = await crearExpediente(prisma, ts.id, [
        'PSICOLOGIA',
      ]);
      const atencion = await prisma.atencionPsicologica.create({
        data: {
          expedienteId: expediente.id,
          psicologaAsignadaId: profesional.id,
          actualizadoPorId: profesional.id,
          fechaInicio: new Date(fechaHora),
        },
      });
      await prisma.citaPsicologica.create({
        data: {
          atencionId: atencion.id,
          fechaHora: new Date(fechaHora),
          estado: 'ATENDIDA',
          diagnostico: 'Dato ficticio',
          atencionBrindada: 'Dato ficticio',
          atendidoPorId: profesional.id,
        },
      });
      return expediente;
    }

    async function descargar(
      profesional: Usuario,
      desde: string,
      hasta: string,
    ) {
      const sesion = sesionDe(app, profesional);
      const respuesta = await request(app.getHttpServer())
        .get('/api/psicologia/indicadores.xlsx')
        .query({ desde, hasta })
        .set('Cookie', sesion.cookie)
        .buffer(true)
        .parse((res, callback) => {
          const partes: Buffer[] = [];
          res.on('data', (parte: Buffer) => partes.push(parte));
          res.on('end', () => callback(null, Buffer.concat(partes)));
        });
      return respuesta;
    }

    it('solo trae mis procesos con sesiones dentro del rango, bordes incluidos en hora de Guatemala', async () => {
      // 23:30 del 31 de marzo en Guatemala = 05:30 UTC del 1 de abril: es de marzo.
      const ultimoDia = await sesionAtendida(
        psicologa,
        '2096-04-01T05:30:00.000Z',
      );
      // 00:15 del 1 de marzo en Guatemala.
      const primerDia = await sesionAtendida(
        psicologa,
        '2096-03-01T06:15:00.000Z',
      );
      const fueraDelRango = await sesionAtendida(
        psicologa,
        '2096-04-01T07:00:00.000Z',
      );
      const deOtra = await sesionAtendida(
        otraPsicologa,
        '2096-03-15T15:00:00.000Z',
      );

      const respuesta = await descargar(psicologa, '2096-03-01', '2096-03-31');

      expect(respuesta.status).toBe(200);
      expect(respuesta.headers['content-disposition']).toContain(
        'psicologia-personas-atendidas_2096-03-01_2096-03-31.xlsx',
      );
      const libro = new Workbook();
      await libro.xlsx.load(
        respuesta.body as Parameters<typeof libro.xlsx.load>[0],
      );
      const hoja = libro.worksheets[0];
      const encabezados = encabezadosDe(hoja, 'No. expediente');
      const columna = encabezados.indexOf('No. expediente') + 1;
      const numeros: unknown[] = [];
      hoja.eachRow((fila, indice) => {
        if (indice > filaEncabezado(hoja, 'No. expediente')) {
          numeros.push(fila.getCell(columna).value);
        }
      });

      expect(numeros.sort()).toEqual(
        [primerDia.numero, ultimoDia.numero].sort(),
      );
      expect(numeros).not.toContain(fueraDelRango.numero);
      expect(numeros).not.toContain(deOtra.numero);
      expect(encabezados).toEqual(
        expect.arrayContaining(['No. expediente', 'Estado', 'Responsable']),
      );
      expect(encabezados).not.toContain('Ingreso');
    });

    it('rechaza un rango con "Desde" después de "Hasta"', async () => {
      const respuesta = await descargar(psicologa, '2096-04-01', '2096-03-01');

      expect(respuesta.status).toBe(400);
    });

    it('otra área no puede descargar el Excel de Psicología', async () => {
      const respuesta = await descargar(ts, '2096-03-01', '2096-03-31');

      expect(respuesta.status).toBe(403);
    });
  });
});

/** Número de la fila que contiene el encabezado buscado (el Excel puede tener una fila de grupos). */
function filaEncabezado(
  hoja: import('exceljs').Worksheet,
  titulo: string,
): number {
  for (let indice = 1; indice <= Math.min(hoja.rowCount, 5); indice += 1) {
    const valores = hoja.getRow(indice).values as unknown[];
    if (valores.includes(titulo)) return indice;
  }
  throw new Error(`No se encontró el encabezado "${titulo}"`);
}

/** Títulos de la fila de encabezados, en orden. */
function encabezadosDe(
  hoja: import('exceljs').Worksheet,
  titulo: string,
): unknown[] {
  return (hoja.getRow(filaEncabezado(hoja, titulo)).values as unknown[]).slice(
    1,
  );
}
