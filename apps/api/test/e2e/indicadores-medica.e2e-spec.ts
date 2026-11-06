import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type { IndicadoresMedica } from '@akyuam/shared';
import ExcelJS from 'exceljs';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  crearApp,
  crearExpediente,
  crearNino,
  crearUsuario,
  sesionDe,
  type Sesion,
} from './fixtures';

describe('Médica · indicadores por periodo y filtros (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let medicaA: Usuario;
  let medicaB: Usuario;
  let sesionA: Sesion;
  let sesionB: Sesion;
  // Un año lejano y distinto en cada corrida: los indicadores agregan todas las consultas del periodo.
  const anio = randomInt(2300, 2900);
  const desde = `${anio}-03-01`;
  const hasta = `${anio}-04-30`;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    medicaA = await crearUsuario(prisma, 'MEDICA');
    medicaB = await crearUsuario(prisma, 'MEDICA');
    sesionA = sesionDe(app, medicaA);
    sesionB = sesionDe(app, medicaB);
    const trabajoSocial = await crearUsuario(prisma, 'TRABAJO_SOCIAL');

    // Una usuaria con su hijo: primera consulta en marzo (A), la del hijo en marzo (A) y una
    // de seguimiento de la usuaria en abril (B).
    const { expediente } = await crearExpediente(prisma, trabajoSocial.id, [
      'MEDICA',
    ]);
    const atencion = await prisma.atencionMedica.create({
      data: {
        expedienteId: expediente.id,
        consecutivo: 1,
        referidoId: expediente.referidos[0].id,
        fechaInicio: new Date(`${anio}-03-01`),
        creadoPorId: medicaA.id,
      },
    });
    const nino = await crearNino(prisma, expediente.id);
    const consulta = (
      fecha: string,
      registradaPorId: string,
      ninoId?: string,
    ) =>
      prisma.consultaMedica.create({
        data: {
          atencionId: atencion.id,
          // 10:00 en Guatemala.
          fechaHora: new Date(`${fecha}T16:00:00.000Z`),
          diagnostico: 'Dato ficticio',
          atencionBrindada: 'Dato ficticio',
          registradaPorId,
          ninoId,
        },
      });
    await consulta(`${anio}-03-10`, medicaA.id);
    await consulta(`${anio}-03-20`, medicaA.id, nino.id);
    await consulta(`${anio}-04-05`, medicaB.id);
  });

  afterAll(async () => {
    await app.close();
  });

  function pedir(
    ruta: string,
    query: Record<string, string>,
    sesion = sesionA,
  ) {
    return request(app.getHttpServer())
      .get(ruta)
      .query(query)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf);
  }

  async function indicadores(
    filtros: Record<string, string> = {},
    sesion = sesionA,
  ) {
    const respuesta = await pedir(
      '/api/medica/reportes',
      { desde, hasta, ...filtros },
      sesion,
    ).expect(200);
    return respuesta.body as IndicadoresMedica;
  }

  it('agrega el periodo y trae una columna por cada mes que toca', async () => {
    const reporte = await indicadores();
    expect(reporte.total).toMatchObject({
      consultas: 3,
      personasAtendidas: 2,
      primerasConsultas: 1,
    });
    expect(
      reporte.meses.map((m) => [
        m.anio,
        m.mes,
        m.consultas,
        m.personasAtendidas,
      ]),
    ).toEqual([
      [anio, 3, 2, 2],
      [anio, 4, 1, 1],
    ]);
  });

  it('filtra por usuarias o hijos/as, por quien registró y por primeras consultas', async () => {
    expect((await indicadores({ persona: 'USUARIAS' })).total.consultas).toBe(
      2,
    );
    expect((await indicadores({ persona: 'HIJOS' })).total.consultas).toBe(1);
    expect((await indicadores({ soloPrimeras: 'true' })).total.consultas).toBe(
      1,
    );
    // "Mis consultas" sale de la sesión: la misma petición da distinto a cada médica.
    expect((await indicadores({ alcance: 'MIAS' })).total.consultas).toBe(2);
    expect(
      (await indicadores({ alcance: 'MIAS' }, sesionB)).total.consultas,
    ).toBe(1);
  });

  it('rechaza un rango al revés o de más de 12 meses', async () => {
    await pedir('/api/medica/reportes', { desde: hasta, hasta: desde }).expect(
      400,
    );
    await pedir('/api/medica/reportes', {
      desde: `${anio}-01-01`,
      hasta: `${anio + 1}-01-01`,
    }).expect(400);
    await pedir('/api/medica/reportes', { anio: String(anio) }).expect(400);
  });

  it('el Excel respeta el periodo y los filtros, los anota al pie y se audita sin datos de personas', async () => {
    const respuesta = await pedir('/api/medica/reportes/excel', {
      desde,
      hasta,
      persona: 'USUARIAS',
    })
      .buffer(true)
      .parse((res, listo) => {
        const partes: Buffer[] = [];
        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => listo(null, Buffer.concat(partes)));
      })
      .expect(200);

    expect(respuesta.headers['cache-control']).toBe('no-store');
    expect(respuesta.headers['content-disposition']).toBe(
      `attachment; filename="medicina-indicadores_${desde}_${hasta}.xlsx"`,
    );

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(respuesta.body as Buffer);
    const hoja = libro.worksheets[0];
    const filas = hoja.getSheetValues().filter(Boolean) as unknown[][];
    // getSheetValues indexa desde 1: la celda A es el índice 1.
    expect(filas[0].slice(1)).toEqual([
      'Indicador',
      'Categoría',
      'Mar',
      'Abr',
      'Total',
    ]);
    // Solo usuarias: 1 consulta en marzo y 1 en abril (como "<3"), 2 en total.
    expect(filas[1].slice(1)).toEqual(['Consultas', 'Total', '<3', '<3', '<3']);
    const pie = new Map(filas.map((fila) => [fila[1], fila[2]]));
    expect(pie.get('Personas')).toBe('Solo usuarias');
    expect(pie.get('Tipo de consulta')).toBe('Todas las consultas');
    expect(pie.get('Personal')).toBe('Todo el personal');

    const evento = await prisma.auditLog.findFirst({
      where: { usuarioId: medicaA.id, accion: 'REPORTE_MEDICA_EXPORTADO' },
      orderBy: { createdAt: 'desc' },
    });
    expect(evento?.detalles).toEqual({
      desde,
      hasta,
      persona: 'USUARIAS',
      alcance: 'TODO',
      soloPrimeras: false,
    });
  });
});
