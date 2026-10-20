import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Rol, Usuario } from '@prisma/client';
import {
  anioCalendarioGT,
  fechaCalendarioGT,
  horaGT,
  type FilaPoblacionJuridico,
  type ReportePoblacionJuridico,
  type ReporteProcesosJuridico,
} from '@akyuam/shared';
import { Workbook } from 'exceljs';
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
  instanteFuturo,
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
  '/api/juridico/reportes/procesos?cartera=ANIO',
  '/api/juridico/reportes/procesos.xlsx?cartera=ANIO',
  '/api/juridico/reportes/poblacion-beneficiada?cartera=ANIO',
  '/api/juridico/reportes/poblacion-beneficiada.xlsx?cartera=ANIO',
];

const TIPO_XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Columna "No. de caso" del Excel de población beneficiada (1 = primera columna). */
const COLUMNA_NUMERO_CASO = 5;

describe('Jurídico · reportes: población beneficiada y procesos (e2e)', () => {
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

  /** Descarga el Excel y devuelve los "No. de caso" que trae. */
  async function casosEnExcel(query: string): Promise<string[]> {
    const respuesta = await pedir(
      `/api/juridico/reportes/poblacion-beneficiada.xlsx?${query}`,
    )
      .buffer(true)
      .parse((res, listo) => {
        const partes: Buffer[] = [];
        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => listo(null, Buffer.concat(partes)));
      })
      .expect(200);
    const libro = new Workbook();
    await libro.xlsx.load(respuesta.body as Buffer);
    const hoja = libro.worksheets[0];
    const casos: string[] = [];
    hoja.eachRow((fila, numero) => {
      if (numero > 1) casos.push(fila.getCell(COLUMNA_NUMERO_CASO).text);
    });
    return casos;
  }

  /** Expediente referido a Jurídico con procesos en las fechas dadas. */
  async function expedienteConProcesos(
    procesos: { fechaInicio: string; cerrado?: boolean }[],
  ) {
    const { expediente, usuaria } = await crearExpediente(
      prisma,
      trabajoSocial.id,
      ['JURIDICO'],
    );
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
    it('sin sesión responde 401 en los cuatro endpoints', async () => {
      for (const ruta of RUTAS) {
        await request(app.getHttpServer()).get(ruta).expect(401);
      }
    });

    it.each(OTROS_ROLES)(
      '%s recibe 403 en los cuatro endpoints',
      async (rol) => {
        for (const ruta of RUTAS) {
          await pedir(ruta, sesiones.get(rol)).expect(403);
        }
      },
    );

    it('en "Todos" exige el rango de fechas', async () => {
      await pedir('/api/juridico/reportes/procesos?cartera=TODOS').expect(400);
      await pedir(
        '/api/juridico/reportes/poblacion-beneficiada?cartera=TODOS&desde=2026-05-01&hasta=2026-04-01',
      ).expect(400);
    });
  });

  describe('A · población beneficiada', () => {
    it('separa la cartera del año, la de seguimiento y los casos ya cerrados', async () => {
      const anterior = `${anio - 2}-06-10`;
      const seguimiento = await expedienteConProcesos([
        { fechaInicio: anterior },
      ]);
      const cerrado = await expedienteConProcesos([
        { fechaInicio: anterior, cerrado: true },
      ]);
      // Su primer proceso es de hace dos años: sigue siendo de seguimiento aunque tenga uno nuevo.
      const conProcesoNuevo = await expedienteConProcesos([
        { fechaInicio: anterior, cerrado: true },
        { fechaInicio: hoy },
      ]);
      const delAnio = await expedienteConProcesos([{ fechaInicio: hoy }]);
      // Referido a Jurídico sin proceso todavía: entra con la fecha del referido (hoy).
      const sinProceso = await expedienteConProcesos([]);
      // Devuelto a Trabajo Social sin haber abierto proceso: no se atendió.
      const devuelto = await expedienteConProcesos([]);
      await prisma.referidoArea.updateMany({
        where: { expedienteId: devuelto.expediente.id, area: 'JURIDICO' },
        data: {
          devueltoEn: new Date(),
          devueltoPorId: juridico.id,
          motivoDevolucion: `${MARCA} devuelto`,
        },
      });
      // Nunca referido a Jurídico: aunque tenga proceso, no es de este módulo.
      const noReferido = await crearExpediente(prisma, trabajoSocial.id, [
        'PSICOLOGIA',
      ]);
      await crearProceso(prisma, noReferido.expediente.id, juridico.id, {
        fechaInicio: new Date(hoy),
      });

      const delAnioExcel = await casosEnExcel('cartera=ANIO');
      const seguimientoExcel = await casosEnExcel('cartera=SEGUIMIENTO');
      const numero = (caso: { expediente: { numero: string } }) =>
        caso.expediente.numero;

      expect(delAnioExcel).toEqual(
        expect.arrayContaining([numero(delAnio), numero(sinProceso)]),
      );
      expect(seguimientoExcel).toEqual(
        expect.arrayContaining([numero(seguimiento), numero(conProcesoNuevo)]),
      );
      for (const fuera of [seguimiento, conProcesoNuevo, cerrado]) {
        expect(delAnioExcel).not.toContain(numero(fuera));
      }
      for (const fuera of [delAnio, sinProceso, cerrado]) {
        expect(seguimientoExcel).not.toContain(numero(fuera));
      }
      for (const fuera of [devuelto, noReferido]) {
        expect(delAnioExcel).not.toContain(numero(fuera));
        expect(seguimientoExcel).not.toContain(numero(fuera));
      }
    });

    it('la edad es la que tenía al "Día" y la vista previa trae las 13 columnas', async () => {
      // Un día al azar del siglo pasado: casi nadie más tiene casos ese día.
      const anioDia = 1931 + randomInt(69);
      const dia = `${anioDia}-06-14`;
      const { expediente, usuaria } = await expedienteConProcesos([
        { fechaInicio: dia, cerrado: true },
      ]);
      await prisma.usuaria.update({
        where: { id: usuaria.id },
        // Cumple 30 un día después del "Día": tenía 29.
        data: {
          fechaNacimiento: new Date(`${anioDia - 30}-06-15`),
          municipio: 'COBAN',
        },
      });
      await prisma.expediente.update({
        where: { id: expediente.id },
        data: { tipologiaDelito: ['FISICA', 'PSICOLOGICA'] },
      });

      const respuesta = await pedir(
        `/api/juridico/reportes/poblacion-beneficiada?cartera=TODOS&desde=${dia}&hasta=${dia}`,
      ).expect(200);
      const reporte = respuesta.body as ReportePoblacionJuridico;
      const fila = reporte.vistaPrevia.find(
        (f) => f.numeroCaso === expediente.numero,
      );

      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(reporte.totales.expedientes).toBeGreaterThanOrEqual(1);
      expect(fila).toMatchObject<Partial<FilaPoblacionJuridico>>({
        dia,
        departamento: 'Alta Verapaz',
        municipio: 'Cobán',
        fechaNacimiento: `${anioDia - 30}-06-15`,
        edad: 29,
        rangoEdad: '14 a 30 años',
        nombreApellido: `${usuaria.nombres} ${usuaria.apellidos}`,
        dpi: null,
        tipologia: 'Física, Psicológica',
      });
      expect(Object.keys(fila ?? {})).toHaveLength(13);

      // La auditoría guarda los filtros, nunca los nombres.
      const evento = await prisma.auditLog.findFirst({
        where: { usuarioId: juridico.id, accion: 'REPORTE_CONSULTADO' },
        orderBy: { createdAt: 'desc' },
      });
      expect(evento?.detalles).toMatchObject({
        reporte: 'POBLACION_JURIDICO',
        cartera: 'TODOS',
        desde: dia,
        hasta: dia,
      });
      expect(JSON.stringify(evento?.detalles)).not.toContain(MARCA);
    });
  });

  describe('B · procesos', () => {
    it('trae totales, cartera y audiencias, y filtra por cartera y tipo', async () => {
      const abogada = await crearAbogada(prisma);
      const { expediente } = await expedienteConProcesos([
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
        where: { id: procesos[1].id },
        data: { tipo: 'DIVORCIO_MUTUO_ACUERDO' },
      });
      const proxima = instanteFuturo();
      const realizada = new Date('2025-02-03T15:30:00.000Z');
      await prisma.audienciaJuridica.create({
        data: {
          procesoId: procesos[0].id,
          responsableId: abogada.id,
          inicio: proxima,
          creadoPorId: juridico.id,
        },
      });
      await prisma.audienciaJuridica.create({
        data: {
          procesoId: procesos[0].id,
          responsableId: abogada.id,
          inicio: realizada,
          estado: 'REALIZADA',
          resultadoEn: new Date('2025-02-03T17:00:00.000Z'),
          creadoPorId: juridico.id,
        },
      });

      const todos = (
        await pedir(
          `/api/juridico/reportes/procesos?cartera=TODOS&desde=2000-01-01&hasta=${hoy}&abogadaId=${abogada.id}`,
        ).expect(200)
      ).body as ReporteProcesosJuridico;

      expect(todos.totales).toEqual({
        procesos: 2,
        expedientes: 1,
        usuarias: 1,
      });
      const [antiguo, nuevo] = todos.vistaPrevia;
      expect(antiguo).toMatchObject({
        numeroProceso: 2,
        cartera: `Seguimiento (${anio - 2})`,
        proximaAudiencia: null,
      });
      expect(nuevo).toMatchObject({
        expedienteNumero: expediente.numero,
        numeroProceso: 1,
        cartera: String(anio),
        proximaAudiencia: {
          fecha: fechaCalendarioGT(proxima),
          hora: horaGT(proxima),
        },
        ultimaAudienciaRealizada: { fecha: '2025-02-03', hora: '09:30' },
      });

      const seguimiento = (
        await pedir(
          `/api/juridico/reportes/procesos?cartera=SEGUIMIENTO&abogadaId=${abogada.id}`,
        ).expect(200)
      ).body as ReporteProcesosJuridico;
      expect(seguimiento.vistaPrevia.map((f) => f.numeroProceso)).toEqual([2]);

      const porTipo = (
        await pedir(
          `/api/juridico/reportes/procesos?cartera=ANIO&abogadaId=${abogada.id}&tipo=DIVORCIO_MUTUO_ACUERDO`,
        ).expect(200)
      ).body as ReporteProcesosJuridico;
      expect(porTipo.totales.procesos).toBe(0);
    });

    it('el Excel se descarga sin caché, con un nombre sin datos personales, y se audita', async () => {
      const abogada = await crearAbogada(prisma);
      const respuesta = await pedir(
        `/api/juridico/reportes/procesos.xlsx?cartera=SEGUIMIENTO&abogadaId=${abogada.id}`,
      ).expect(200);

      expect(respuesta.headers['content-type']).toContain(TIPO_XLSX);
      expect(respuesta.headers['cache-control']).toBe('no-store');
      expect(respuesta.headers['content-disposition']).toBe(
        `attachment; filename="procesos-juridicos_seguimiento_${hoy}.xlsx"`,
      );
      const evento = await prisma.auditLog.findFirst({
        where: { usuarioId: juridico.id, accion: 'REPORTE_JURIDICO_EXPORTADO' },
        orderBy: { createdAt: 'desc' },
      });
      expect(evento?.detalles).toMatchObject({
        reporte: 'PROCESOS_JURIDICOS',
        cartera: 'SEGUIMIENTO',
        abogadaId: abogada.id,
        filas: 0,
      });
    });
  });
});
