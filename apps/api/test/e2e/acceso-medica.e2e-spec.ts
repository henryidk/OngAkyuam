import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Rol, Usuario } from '@prisma/client';
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
