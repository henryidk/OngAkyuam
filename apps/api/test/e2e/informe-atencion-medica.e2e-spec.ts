import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Rol, Usuario } from '@prisma/client';
import { sumarDiasGT, type InformeAtencionMedica } from '@akyuam/shared';
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

const OTROS_ROLES: Rol[] = [
  'TRABAJO_SOCIAL',
  'PSICOLOGIA',
  'JURIDICO',
  'ADMINISTRACION',
];

const TIPO_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('Médica · informe de atención (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let medica: Usuario;
  let sesionMedica: Sesion;
  let trabajoSocial: Usuario;
  const sesiones = new Map<Rol, Sesion>();
  // Un día lejano y distinto en cada corrida: el informe agrega todas las consultas del periodo.
  const anio = randomInt(2300, 2900);
  const dia = `${anio}-06-15`;
  const rutas = [
    `/api/medica/reportes/atencion?desde=${dia}&hasta=${dia}`,
    `/api/medica/reportes/atencion.xlsx?desde=${dia}&hasta=${dia}`,
  ];

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    medica = await crearUsuario(prisma, 'MEDICA');
    sesionMedica = sesionDe(app, medica);
    for (const rol of OTROS_ROLES) {
      const usuario = await crearUsuario(prisma, rol);
      if (rol === 'TRABAJO_SOCIAL') trabajoSocial = usuario;
      sesiones.set(rol, sesionDe(app, usuario));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  function pedir(ruta: string, sesion = sesionMedica) {
    return request(app.getHttpServer())
      .get(ruta)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf);
  }

  /** Expediente referido a Médica con su atención, ligada a la referencia. */
  async function expedienteEnMedica() {
    const { expediente, usuaria } = await crearExpediente(
      prisma,
      trabajoSocial.id,
      ['MEDICA'],
    );
    const atencion = await prisma.atencionMedica.create({
      data: {
        expedienteId: expediente.id,
        consecutivo: 1,
        referidoId: expediente.referidos[0].id,
        fechaInicio: new Date(`${anio}-01-01`),
        creadoPorId: medica.id,
      },
    });
    return { expediente, usuaria, atencion };
  }

  function consulta(
    atencionId: string,
    fecha: string,
    extra: { ninoId?: string; modalidad?: 'PRESENCIAL' | 'TELEFONICA' } = {},
  ) {
    return prisma.consultaMedica.create({
      data: {
        atencionId,
        // 10:00 en Guatemala.
        fechaHora: new Date(`${fecha}T16:00:00.000Z`),
        diagnostico: 'Dato ficticio',
        atencionBrindada: 'Dato ficticio',
        registradaPorId: medica.id,
        ...extra,
      },
    });
  }

  describe('acceso', () => {
    it('sin sesión responde 401 en los dos endpoints', async () => {
      for (const ruta of rutas) {
        await request(app.getHttpServer()).get(ruta).expect(401);
      }
    });

    it.each(OTROS_ROLES)('%s recibe 403 en los dos endpoints', async (rol) => {
      for (const ruta of rutas) {
        await pedir(ruta, sesiones.get(rol)).expect(403);
      }
    });

    it('exige un rango completo y en orden', async () => {
      await pedir('/api/medica/reportes/atencion').expect(400);
      await pedir(
        '/api/medica/reportes/atencion?desde=2026-05-01&hasta=2026-04-01',
      ).expect(400);
      await pedir(
        '/api/medica/reportes/atencion?desde=2026-02-30&hasta=2026-04-01',
      ).expect(400);
    });
  });

  it('cuenta nuevo ingreso, seguimiento, indirectos, telefónicas y albergadas', async () => {
    // Nueva: maya de 20 años, en el albergue, con una consulta telefónica y su hijo atendido.
    const nueva = await expedienteEnMedica();
    await prisma.usuaria.update({
      where: { id: nueva.usuaria.id },
      data: {
        grupoEtnico: 'MAYA',
        fechaNacimiento: new Date(`${anio - 20}-01-01`),
      },
    });
    await prisma.expediente.update({
      where: { id: nueva.expediente.id },
      data: { fechaIngresoAlbergue: new Date(`${anio}-06-01`) },
    });
    const nino = await crearNino(prisma, nueva.expediente.id);
    await prisma.hijoUsuaria.update({
      where: { id: nino.hijoId },
      data: {
        genero: 'HOMBRE',
        fechaNacimiento: new Date(`${anio - 5}-01-01`),
      },
    });
    await consulta(nueva.atencion.id, dia, { modalidad: 'TELEFONICA' });
    await consulta(nueva.atencion.id, dia, { ninoId: nino.id });

    // Seguimiento: ya se le atendió el día anterior al periodo (nacida en 1990, grupo "Otro").
    const seguimiento = await expedienteEnMedica();
    await consulta(seguimiento.atencion.id, sumarDiasGT(dia, -1));
    await consulta(seguimiento.atencion.id, dia);

    const informe = (await pedir(rutas[0]).expect(200))
      .body as InformeAtencionMedica;

    const fila = (clave: string) =>
      informe.filas.find((f) => f.clave === clave);
    expect(fila('NUEVO_INGRESO')).toMatchObject({
      mujer: 1,
      hombre: 0,
      total: 1,
      etnia: { MAYA: 1, OTRO: 0 },
      edad: { '16-30': 1 },
    });
    expect(fila('SEGUIMIENTO')).toMatchObject({
      mujer: 1,
      total: 1,
      etnia: { OTRO: 1 },
      edad: { '46+': 1 },
    });
    expect(fila('INDIRECTOS')).toMatchObject({
      mujer: 0,
      hombre: 1,
      total: 1,
      etnia: { MAYA: 1 },
      edad: { '0-15': 1 },
    });
    expect(fila('TELEFONICA')).toMatchObject({ mujer: 1, total: 1 });
    expect(fila('ALBERGADAS')).toMatchObject({ mujer: 1, total: 1 });
    expect(informe.totales).toMatchObject({ mujer: 4, hombre: 1, total: 5 });
  });

  it('el Excel se descarga sin caché, con el periodo en el nombre, y se audita solo el periodo', async () => {
    const respuesta = await pedir(rutas[1]).expect(200);

    expect(respuesta.headers['content-type']).toContain(TIPO_XLSX);
    expect(respuesta.headers['cache-control']).toBe('no-store');
    expect(respuesta.headers['content-disposition']).toBe(
      `attachment; filename="medicina-atencion_${dia}_${dia}.xlsx"`,
    );
    const evento = await prisma.auditLog.findFirst({
      where: {
        usuarioId: medica.id,
        accion: 'INFORME_ATENCION_MEDICA_EXPORTADO',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(evento?.detalles).toEqual({
      reporte: 'ATENCION_MEDICA',
      desde: dia,
      hasta: dia,
    });
  });
});
