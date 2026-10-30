import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Rol, Usuario } from '@prisma/client';
import {
  anioCalendarioGT,
  fechaCalendarioGT,
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
  '/api/juridico/reportes/poblacion-beneficiada?anio=2026',
  '/api/juridico/reportes/poblacion-beneficiada.xlsx?anio=2026',
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

    it('sin carpeta exige el rango de fechas, y un año fuera de rango no se acepta', async () => {
      await pedir('/api/juridico/reportes/procesos').expect(400);
      await pedir(
        '/api/juridico/reportes/poblacion-beneficiada?desde=2026-05-01&hasta=2026-04-01',
      ).expect(400);
      await pedir('/api/juridico/reportes/procesos?anio=1989').expect(400);
    });
  });

  describe('A · población beneficiada', () => {
    it.each([
      ['vacía', []],
      ['nula', null],
    ] as const)(
      'la base rechaza un expediente con la tipología %s',
      async (_caso, tipologia) => {
        const { usuaria } = await crearExpediente(prisma, trabajoSocial.id, []);
        await expect(
          prisma.$executeRaw`
            INSERT INTO "Expediente" (id, numero, "usuariaId", fecha, "tipoRegistro", "tipologiaDelito", "creadoPorId", "updatedAt")
            VALUES (gen_random_uuid(), ${`E2E-SIN-${usuaria.id.slice(0, 8)}`}, ${usuaria.id}, '2026-01-01',
                    'EXTERNA', ${tipologia}::"TipologiaDelito"[], ${trabajoSocial.id}, now())`,
        ).rejects.toThrow(/Expediente_tipologia_obligatoria_chk/);
      },
    );

    it('cada carpeta trae los expedientes de su año, sigan abiertos o no y aunque se retomen después', async () => {
      const anioAntiguo = anio - 12;
      const expedienteAntiguo = `${anioAntiguo}-07-15`;
      // Expediente de hace 12 años con un proceso que se retomó este año.
      const retomado = await expedienteConProcesos(
        [{ fechaInicio: hoy }],
        expedienteAntiguo,
      );
      const antiguoCerrado = await expedienteConProcesos(
        [{ fechaInicio: expedienteAntiguo, cerrado: true }],
        expedienteAntiguo,
      );
      const delAnio = await expedienteConProcesos([{ fechaInicio: hoy }]);
      // Referido a Jurídico sin proceso todavía: va en la carpeta del año de su expediente.
      const sinProceso = await expedienteConProcesos([]);
      // Nunca referido a Jurídico: aunque tenga proceso, no es de este módulo.
      const noReferido = await crearExpediente(prisma, trabajoSocial.id, [
        'PSICOLOGIA',
      ]);
      await crearProceso(prisma, noReferido.expediente.id, juridico.id, {
        fechaInicio: new Date(hoy),
      });

      const antiguoExcel = await casosEnExcel(`anio=${anioAntiguo}`);
      const delAnioExcel = await casosEnExcel(`anio=${anio}`);
      const numero = (caso: { expediente: { numero: string } }) =>
        caso.expediente.numero;

      expect(antiguoExcel).toEqual(
        expect.arrayContaining([numero(retomado), numero(antiguoCerrado)]),
      );
      expect(delAnioExcel).toEqual(
        expect.arrayContaining([numero(delAnio), numero(sinProceso)]),
      );
      for (const fuera of [delAnio, sinProceso, noReferido]) {
        expect(antiguoExcel).not.toContain(numero(fuera));
      }
      for (const fuera of [retomado, antiguoCerrado, noReferido]) {
        expect(delAnioExcel).not.toContain(numero(fuera));
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
        `/api/juridico/reportes/poblacion-beneficiada?desde=${dia}&hasta=${dia}`,
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
        anio: null,
        desde: dia,
        hasta: dia,
      });
      expect(JSON.stringify(evento?.detalles)).not.toContain(MARCA);
    });
  });

  describe('B · procesos', () => {
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
        numeroInterno: `${expediente.numero} · Proceso 2`,
        tipo: 'DIVORCIO_MUTUO_ACUERDO',
        ultimoAvance: null,
        abogada: abogada.nombre,
        procuradora: null,
      });
      expect(nuevo).toMatchObject({
        numeroInterno: expediente.numero,
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
      expect(deProcuradora.vistaPrevia.map((f) => f.numeroInterno)).toEqual([
        expediente.numero,
      ]);

      // Los dos procesos van en la carpeta del expediente, aunque uno empezó hace dos años.
      const porTipo = (
        await pedir(
          `/api/juridico/reportes/procesos?anio=${anio}&responsableId=${abogada.id}&tipo=DIVORCIO_MUTUO_ACUERDO`,
        ).expect(200)
      ).body as ReporteProcesosJuridico;
      expect(porTipo.vistaPrevia.map((f) => f.numeroInterno)).toEqual([
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
