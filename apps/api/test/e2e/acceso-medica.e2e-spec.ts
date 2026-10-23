import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Rol, Usuario } from '@prisma/client';
import type {
  ConsultaMedicaDto,
  HistorialConsultasMedicaPaginaDto,
} from '@akyuam/shared';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  MARCA,
  crearApp,
  crearAtencionConConsulta,
  crearExpediente,
  crearUsuario,
  sesionDe,
  type Sesion,
} from './fixtures';

type Metodo = 'get' | 'post' | 'patch' | 'delete';

const ID = randomUUID();
// Todos los endpoints del módulo. Con otro rol, el RolesGuard responde 403 antes de leer
// parámetros o cuerpo, así que basta un id cualquiera.
const ENDPOINTS: [Metodo, string][] = [
  ['get', '/api/medica/bandeja'],
  ['get', '/api/medica/contadores'],
  ['get', '/api/medica/agenda'],
  ['get', '/api/medica/agenda/dia'],
  ['get', '/api/medica/agenda/disponibilidad'],
  ['get', '/api/medica/agenda/programables'],
  ['get', '/api/medica/pacientes'],
  ['get', `/api/medica/pacientes/${ID}`],
  ['get', `/api/medica/pacientes/${ID}/consultas`],
  ['get', `/api/medica/pacientes/${ID}/documentos`],
  ['get', '/api/medica/reportes'],
  ['get', '/api/medica/reportes/excel'],
  ['get', '/api/medica/consultas/contexto'],
  ['get', '/api/medica/consultas/por-atender'],
  ['post', '/api/medica/consultas/historial/busqueda'],
  ['get', `/api/medica/consultas/${ID}`],
  ['get', `/api/medica/documentos/${ID}/url`],
  ['post', '/api/medica/citas'],
  ['post', `/api/medica/citas/${ID}/inasistencia`],
  ['post', `/api/medica/citas/${ID}/reprogramacion`],
  ['post', '/api/medica/consultas'],
  ['post', `/api/medica/consultas/${ID}/documentos`],
  ['post', '/api/medica/documentos/pendientes'],
  ['patch', `/api/medica/documentos/pendientes/${ID}`],
  ['delete', `/api/medica/documentos/pendientes/${ID}`],
  ['post', `/api/medica/atenciones/${ID}/alta`],
  ['patch', `/api/medica/atenciones/${ID}/visibilidad`],
];
const OTROS_ROLES: Rol[] = [
  'TRABAJO_SOCIAL',
  'JURIDICO',
  'PSICOLOGIA',
  'ADMINISTRACION',
];
const DATOS_CLINICOS = [
  'diagnostico',
  'planTratamiento',
  'recetaLaboratorios',
  'motivoConsulta',
  `${MARCA} diagnóstico`,
  `${MARCA} plan`,
  `${MARCA} receta`,
  `${MARCA} motivo`,
];

describe('Medicina · acceso (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let medica: Usuario;
  let sesionMedica: Sesion;
  const sesiones = new Map<Rol, Sesion>();

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    medica = await crearUsuario(prisma, 'MEDICA');
    sesionMedica = sesionDe(app, medica);
    for (const rol of OTROS_ROLES) {
      sesiones.set(rol, sesionDe(app, await crearUsuario(prisma, rol)));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  function pedir(metodo: Metodo, ruta: string, sesion: Sesion) {
    return request(app.getHttpServer())
      [metodo](ruta)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf);
  }

  describe('otro rol', () => {
    it.each(
      OTROS_ROLES.flatMap((rol) =>
        ENDPOINTS.map(([metodo, ruta]) => [rol, metodo, ruta] as const),
      ),
    )('%s → %s %s responde 403', async (rol, metodo, ruta) => {
      await pedir(metodo, ruta, sesiones.get(rol)!).expect(403);
    });

    it('sin sesión responde 401', async () => {
      await request(app.getHttpServer()).get('/api/medica/bandeja').expect(401);
    });
  });

  describe('controles: con el acceso correcto sí responde', () => {
    it('la médica ve la ficha de una usuaria referida a Medicina', async () => {
      const { usuaria } = await crearExpediente(prisma, medica.id, ['MEDICA']);
      await pedir(
        'get',
        `/api/medica/pacientes/${usuaria.id}`,
        sesionMedica,
      ).expect(200);
    });

    it('Jurídico firma la constancia compartida de su propia usuaria', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      const { documento } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
        { visibleJuridico: true, tipoDocumento: 'CONSTANCIA' },
      );
      await pedir(
        'get',
        `/api/juridico/usuarias/${usuaria.id}/medicina/documentos/${documento.id}/url`,
        sesiones.get('JURIDICO')!,
      ).expect(200);
    });
  });

  describe('expediente no referido a Medicina', () => {
    it('no se ve la ficha de la usuaria ni se le programa cita', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'JURIDICO',
      ]);
      await pedir(
        'get',
        `/api/medica/pacientes/${usuaria.id}`,
        sesionMedica,
      ).expect(403);
      await pedir('post', '/api/medica/citas', sesionMedica)
        .send({
          expedienteId: expediente.id,
          ninoId: null,
          inicio: '2099-01-05T09:00',
        })
        .expect(403);
      expect(
        await prisma.atencionMedica.count({
          where: { expedienteId: expediente.id },
        }),
      ).toBe(0);
    });

    it('la referencia de otra área no sirve para abrir una atención', async () => {
      const { expediente } = await crearExpediente(prisma, medica.id, [
        'PSICOLOGIA',
      ]);
      await pedir('post', '/api/medica/citas', sesionMedica)
        .send({
          referidoId: expediente.referidos[0].id,
          ninoId: null,
          inicio: '2099-01-05T09:00',
        })
        .expect(403);
    });
  });

  describe('documento de otro expediente', () => {
    it('Medicina no firma un documento de un expediente que no le refirieron', async () => {
      // Quedó de una referencia anterior que Trabajo Social ya retiró.
      const { expediente } = await crearExpediente(prisma, medica.id, [
        'JURIDICO',
      ]);
      const { documento } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
      );
      await pedir(
        'get',
        `/api/medica/documentos/${documento.id}/url`,
        sesionMedica,
      ).expect(403);
    });

    it('Jurídico no firma la constancia de otra usuaria pidiéndola por la suya', async () => {
      const ajena = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      const { documento } = await crearAtencionConConsulta(
        prisma,
        ajena.expediente.id,
        medica.id,
        { visibleJuridico: true, tipoDocumento: 'CONSTANCIA' },
      );
      const propia = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      await pedir(
        'get',
        `/api/juridico/usuarias/${propia.usuaria.id}/medicina/documentos/${documento.id}/url`,
        sesiones.get('JURIDICO')!,
      ).expect(403);
    });

    it('Jurídico no firma una receta aunque la atención esté compartida', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      const { documento } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
        { visibleJuridico: true, tipoDocumento: 'RECETA' },
      );
      await pedir(
        'get',
        `/api/juridico/usuarias/${usuaria.id}/medicina/documentos/${documento.id}/url`,
        sesiones.get('JURIDICO')!,
      ).expect(403);
    });
  });

  describe('Consultas: historial y detalle', () => {
    // El día de las consultas de `crearAtencionConConsulta`.
    const RANGO = { desde: '2026-01-02', hasta: '2026-01-02' };

    /** DPI único: deja buscar exactamente a una usuaria entre las de todas las pruebas. */
    async function conDpi(usuariaId: string): Promise<string> {
      const dpi = `9${randomInt(10 ** 11, 10 ** 12)}`;
      await prisma.usuaria.update({ where: { id: usuariaId }, data: { dpi } });
      return dpi;
    }

    function buscar(datos: object, sesion: Sesion = sesionMedica) {
      return pedir(
        'post',
        '/api/medica/consultas/historial/busqueda',
        sesion,
      ).send(datos);
    }

    it('la lista solo trae metadatos; el contenido clínico sale al abrir la consulta', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
      ]);
      const { consulta } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
      );
      const dpi = await conDpi(usuaria.id);

      const lista = await buscar({ ...RANGO, q: dpi }).expect(200);
      const pagina = lista.body as HistorialConsultasMedicaPaginaDto;
      expect(lista.headers['cache-control']).toBe('no-store');
      expect(pagina.items).toHaveLength(1);
      expect(pagina.items[0]).toMatchObject({
        id: consulta.id,
        usuariaId: usuaria.id,
        totalDocumentos: 1,
      });
      for (const clave of [...DATOS_CLINICOS, 'signos']) {
        expect(JSON.stringify(lista.body)).not.toContain(clave);
      }

      const detalle = await pedir(
        'get',
        `/api/medica/consultas/${consulta.id}`,
        sesionMedica,
      ).expect(200);
      expect(detalle.headers['cache-control']).toBe('no-store');
      expect((detalle.body as ConsultaMedicaDto).diagnostico).toBe(
        `${MARCA} diagnóstico clínico`,
      );
      expect(
        await prisma.auditLog.count({
          where: {
            usuarioId: medica.id,
            accion: 'CONSULTA_MEDICA_VISTA',
            entidadId: consulta.id,
          },
        }),
      ).toBe(1);
    });

    it('una consulta de un expediente no referido no aparece y abrirla da el mismo 403 que un id inexistente', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'JURIDICO',
      ]);
      const { consulta } = await crearAtencionConConsulta(
        prisma,
        expediente.id,
        medica.id,
      );
      const dpi = await conDpi(usuaria.id);

      const lista = await buscar({ ...RANGO, q: dpi }).expect(200);
      expect((lista.body as HistorialConsultasMedicaPaginaDto).items).toEqual(
        [],
      );

      const ajena = await pedir(
        'get',
        `/api/medica/consultas/${consulta.id}`,
        sesionMedica,
      ).expect(403);
      const inexistente = await pedir(
        'get',
        `/api/medica/consultas/${randomUUID()}`,
        sesionMedica,
      ).expect(403);
      // Mismo mensaje y código: la respuesta no revela si la consulta existe.
      const sinHora = ({ statusCode, message }: Record<string, unknown>) => ({
        statusCode,
        message,
      });
      expect(sinHora(ajena.body as Record<string, unknown>)).toEqual(
        sinHora(inexistente.body as Record<string, unknown>),
      );
      expect(
        await prisma.auditLog.count({
          where: { accion: 'CONSULTA_MEDICA_VISTA', entidadId: consulta.id },
        }),
      ).toBe(0);
    });

    it('el texto buscado nunca queda en la auditoría', async () => {
      const buscadora = await crearUsuario(prisma, 'MEDICA');
      const termino = `${MARCA} Nombre Buscado`;
      await buscar({ ...RANGO, q: termino }, sesionDe(app, buscadora)).expect(
        200,
      );
      const filas = await prisma.auditLog.findMany({
        where: { usuarioId: buscadora.id },
      });
      expect(filas.map((f) => f.accion)).toEqual([
        'HISTORIAL_CONSULTAS_MEDICAS_CONSULTADO',
      ]);
      expect(filas[0].detalles).toMatchObject({ conBusqueda: true });
      expect(JSON.stringify(filas)).not.toContain('Buscado');
    });

    it('la búsqueda no existe por GET con el texto en la URL', async () => {
      await pedir(
        'get',
        '/api/medica/consultas/historial/busqueda?q=Maria',
        sesionMedica,
      ).expect(404);
    });

    it('rechaza un rango de más de un año', async () => {
      await buscar({ desde: '2025-01-01', hasta: '2026-01-02' }).expect(400);
    });

    it('limita las búsquedas por usuario a 60 por minuto', async () => {
      const sesion = sesionDe(app, await crearUsuario(prisma, 'MEDICA'));
      for (let i = 0; i < 60; i++) {
        await buscar(RANGO, sesion).expect(200);
      }
      await buscar(RANGO, sesion).expect(429);
    });

    it('la historia clínica de la ficha deja constancia de cada página leída', async () => {
      const lectora = await crearUsuario(prisma, 'MEDICA');
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
      ]);
      await crearAtencionConConsulta(prisma, expediente.id, medica.id);
      await pedir(
        'get',
        `/api/medica/pacientes/${usuaria.id}/consultas`,
        sesionDe(app, lectora),
      ).expect(200);
      const filas = await prisma.auditLog.findMany({
        where: {
          usuarioId: lectora.id,
          accion: 'HISTORIA_CLINICA_MEDICA_CONSULTADA',
        },
      });
      expect(filas).toHaveLength(1);
      expect(filas[0]).toMatchObject({
        entidad: 'Usuaria',
        entidadId: usuaria.id,
        detalles: { persona: 'todas', pagina: 'primera', resultados: 1 },
      });
      for (const dato of DATOS_CLINICOS) {
        expect(JSON.stringify(filas)).not.toContain(dato);
      }
    });
  });

  describe('CSRF', () => {
    it.each([
      ['ausente', undefined],
      ['distinto al de la cookie', 'otro-token'],
    ])('con token %s una escritura responde 403', async (_caso, header) => {
      const peticion = request(app.getHttpServer())
        .post('/api/medica/citas')
        .set('Cookie', sesionMedica.cookie);
      if (header) {
        peticion.set('X-CSRF-Token', header);
      }
      const respuesta = await peticion
        .send({ expedienteId: ID, ninoId: null, inicio: '2099-01-05T09:00' })
        .expect(403);
      expect(JSON.stringify(respuesta.body)).toContain('CSRF');
    });
  });

  describe('otras áreas no reciben datos clínicos', () => {
    let expedienteId: string;
    let usuariaId: string;

    beforeAll(async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, medica.id, [
        'MEDICA',
        'JURIDICO',
      ]);
      expedienteId = expediente.id;
      usuariaId = usuaria.id;
      await crearAtencionConConsulta(prisma, expediente.id, medica.id, {
        visibleJuridico: true,
        tipoDocumento: 'CONSTANCIA',
      });
    });

    function sinDatosClinicos(cuerpo: unknown) {
      const texto = JSON.stringify(cuerpo);
      for (const dato of DATOS_CLINICOS) {
        expect(texto).not.toContain(dato);
      }
    }

    it('Trabajo Social ve el estado y las fechas, nunca diagnóstico, plan ni receta', async () => {
      const respuesta = await pedir(
        'get',
        `/api/trabajo-social/expedientes/${expedienteId}/compartido`,
        sesiones.get('TRABAJO_SOCIAL')!,
      ).expect(200);
      expect(JSON.stringify(respuesta.body)).toContain('En atención');
      sinDatosClinicos(respuesta.body);
    });

    it('Jurídico ve fechas y constancias, nunca datos clínicos', async () => {
      const respuesta = await pedir(
        'get',
        `/api/juridico/usuarias/${usuariaId}/medicina`,
        sesiones.get('JURIDICO')!,
      ).expect(200);
      expect(respuesta.body).toHaveLength(1);
      sinDatosClinicos(respuesta.body);
    });
  });
});
