import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Rol, Usuario } from '@prisma/client';
import {
  anioCalendarioGT,
  fechaCalendarioGT,
  type ReporteProcesosJuridico,
} from '@akyuam/shared';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  MARCA,
  crearAbogada,
  crearApp,
  crearExpediente,
  crearProceso,
  crearUsuario,
  sesionDe,
  type Sesion,
} from './fixtures';

const OTROS_ROLES: Rol[] = [
  'TRABAJO_SOCIAL',
  'PSICOLOGIA',
  'MEDICA',
  'ADMINISTRACION',
];

const RUTAS = [
  '/api/juridico/reportes/procesos?anio=2026',
  '/api/juridico/reportes/procesos.xlsx?anio=2026',
];

const TIPO_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('Jurídico · reporte de procesos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let juridico: Usuario;
  let sesionJuridico: Sesion;
  let trabajoSocial: Usuario;
  const sesiones = new Map<Rol, Sesion>();
  // Se calculan como el servidor: año y fecha de hoy en Guatemala.
  const anio = anioCalendarioGT(new Date());
  const hoy = fechaCalendarioGT(new Date());

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    juridico = await crearUsuario(prisma, 'JURIDICO');
    sesionJuridico = sesionDe(app, juridico);
    for (const rol of OTROS_ROLES) {
      const usuario = await crearUsuario(prisma, rol);
      if (rol === 'TRABAJO_SOCIAL') trabajoSocial = usuario;
      sesiones.set(rol, sesionDe(app, usuario));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  function pedir(ruta: string, sesion = sesionJuridico) {
    return request(app.getHttpServer())
      .get(ruta)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf);
  }

  /**
   * Expediente referido a Jurídico, registrado en `fechaExpediente` (por defecto el 1 de enero de
   * este año: define su carpeta), con procesos en las fechas dadas.
   */
  async function expedienteConProcesos(
    procesos: { fechaInicio: string; cerrado?: boolean }[],
    fechaExpediente = `${anio}-01-01`,
  ) {
    const { expediente, usuaria } = await crearExpediente(
      prisma,
      trabajoSocial.id,
      ['JURIDICO'],
    );
    await prisma.expediente.update({
      where: { id: expediente.id },
      data: { fecha: new Date(fechaExpediente) },
    });
    for (const [indice, proceso] of procesos.entries()) {
      const creado = await crearProceso(prisma, expediente.id, juridico.id, {
        consecutivo: indice + 1,
        fechaInicio: new Date(proceso.fechaInicio),
      });
      if (proceso.cerrado) {
        // La base exige la fecha de cierre en un proceso finalizado.
        await prisma.procesoJuridico.update({
          where: { id: creado.id },
          data: {
            fase: 'FINALIZADO',
            fechaCierre: new Date(proceso.fechaInicio),
            formaFinalizacion: 'SENTENCIA',
          },
        });
      }
    }
    return { expediente, usuaria };
  }

  describe('acceso', () => {
    it('sin sesión responde 401 en los dos endpoints', async () => {
      for (const ruta of RUTAS) {
        await request(app.getHttpServer()).get(ruta).expect(401);
      }
    });

    it.each(OTROS_ROLES)('%s recibe 403 en los dos endpoints', async (rol) => {
      for (const ruta of RUTAS) {
        await pedir(ruta, sesiones.get(rol)).expect(403);
      }
    });

    it('sin carpeta exige el rango de fechas, y un año fuera de rango no se acepta', async () => {
      await pedir('/api/juridico/reportes/procesos').expect(400);
      await pedir(
        '/api/juridico/reportes/procesos?desde=2026-05-01&hasta=2026-04-01',
      ).expect(400);
      await pedir('/api/juridico/reportes/procesos?anio=1989').expect(400);
    });
  });

  describe('procesos', () => {
    it('trae totales, responsables y el último avance, y filtra por responsable, carpeta y tipo', async () => {
      const abogada = await crearAbogada(prisma);
      const procuradora = await prisma.personal.create({
        data: {
          area: 'JURIDICO',
          tipo: 'PROCURADORA',
          nombre: `${MARCA} Procuradora ${randomInt(1e9)}`,
        },
      });
      const { expediente, usuaria } = await expedienteConProcesos([
        { fechaInicio: hoy },
        { fechaInicio: `${anio - 2}-03-01` },
      ]);
      const procesos = await prisma.procesoJuridico.findMany({
        where: { expedienteId: expediente.id },
        orderBy: { consecutivo: 'asc' },
      });
      await prisma.procesoJuridico.updateMany({
        where: { expedienteId: expediente.id },
        data: { abogadaId: abogada.id },
      });
      await prisma.procesoJuridico.update({
        where: { id: procesos[0].id },
        data: { procuradoraId: procuradora.id },
      });
      await prisma.procesoJuridico.update({
        where: { id: procesos[1].id },
        data: { tipo: 'DIVORCIO_MUTUO_ACUERDO' },
      });
      // El avance a mano es el que cuenta, aunque después haya una entrada del sistema.
      await prisma.notaAvanceProceso.create({
        data: {
          procesoId: procesos[0].id,
          tipo: 'Memorial',
          contenido: 'Dato ficticio',
          registradoPorId: juridico.id,
          createdAt: new Date('2025-02-03T15:30:00.000Z'),
        },
      });
      await prisma.notaAvanceProceso.create({
        data: {
          procesoId: procesos[0].id,
          tipo: 'Sistema',
          contenido: 'Cambio de estado',
          esSistema: true,
          registradoPorId: juridico.id,
          createdAt: new Date('2025-02-04T15:30:00.000Z'),
        },
      });

      const todos = (
        await pedir(
          `/api/juridico/reportes/procesos?desde=2000-01-01&hasta=${hoy}&responsableId=${abogada.id}`,
        ).expect(200)
      ).body as ReporteProcesosJuridico;

      expect(todos.totales).toEqual({
        procesos: 2,
        expedientes: 1,
        usuarias: 1,
      });
      const [antiguo, nuevo] = todos.vistaPrevia;
      expect(antiguo).toMatchObject({
        expedienteNumero: expediente.numero,
        codigoProceso: `${expediente.numero} · Proceso 2`,
        tipo: 'DIVORCIO_MUTUO_ACUERDO',
        ultimoAvance: null,
        abogada: abogada.nombre,
        procuradora: null,
      });
      expect(nuevo).toMatchObject({
        expedienteNumero: expediente.numero,
        codigoProceso: expediente.numero,
        usuaria: `${usuaria.nombres} ${usuaria.apellidos}`,
        ultimoAvance: {
          fecha: '2025-02-03',
          tipo: 'Memorial',
          contenido: 'Dato ficticio',
        },
        abogada: abogada.nombre,
        procuradora: procuradora.nombre,
        tipologia: 'Psicológica',
      });

      // La procuradora solo ve el proceso que tiene asignado.
      const deProcuradora = (
        await pedir(
          `/api/juridico/reportes/procesos?desde=2000-01-01&hasta=${hoy}&responsableId=${procuradora.id}`,
        ).expect(200)
      ).body as ReporteProcesosJuridico;
      expect(deProcuradora.vistaPrevia.map((f) => f.codigoProceso)).toEqual([
        expediente.numero,
      ]);

      // Los dos procesos van en la carpeta del expediente, aunque uno empezó hace dos años.
      const porTipo = (
        await pedir(
          `/api/juridico/reportes/procesos?anio=${anio}&responsableId=${abogada.id}&tipo=DIVORCIO_MUTUO_ACUERDO`,
        ).expect(200)
      ).body as ReporteProcesosJuridico;
      expect(porTipo.vistaPrevia.map((f) => f.codigoProceso)).toEqual([
        `${expediente.numero} · Proceso 2`,
      ]);

      const otraCarpeta = (
        await pedir(
          `/api/juridico/reportes/procesos?anio=${anio - 2}&responsableId=${abogada.id}`,
        ).expect(200)
      ).body as ReporteProcesosJuridico;
      expect(otraCarpeta.totales.procesos).toBe(0);
    });

    it('el Excel se descarga sin caché, con un nombre sin datos personales, y se audita', async () => {
      const abogada = await crearAbogada(prisma);
      const respuesta = await pedir(
        `/api/juridico/reportes/procesos.xlsx?anio=${anio}&responsableId=${abogada.id}`,
      ).expect(200);

      expect(respuesta.headers['content-type']).toContain(TIPO_XLSX);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(respuesta.headers['content-disposition']).toBe(
        `attachment; filename="procesos-juridicos_${anio}.xlsx"`,
      );
      const evento = await prisma.auditLog.findFirst({
        where: { usuarioId: juridico.id, accion: 'REPORTE_JURIDICO_EXPORTADO' },
        orderBy: { createdAt: 'desc' },
      });
      expect(evento?.detalles).toMatchObject({
        reporte: 'PROCESOS_JURIDICOS',
        anio,
        responsableId: abogada.id,
        filas: 0,
      });
    });
  });
});
