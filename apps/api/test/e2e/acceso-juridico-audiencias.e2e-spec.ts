import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Personal, Rol, Usuario } from '@prisma/client';
import {
  fechaCalendarioGT,
  horaGT,
  type AudienciaAgendadaDto,
  type AudienciaDetalleDto,
  type AudienciasPaginadas,
  type DisponibilidadAudienciasDto,
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
  instanteFuturo,
  sesionDe,
  type Sesion,
} from './fixtures';

type Metodo = 'get' | 'post' | 'patch';

const ID = randomUUID();
// Todos los endpoints de audiencias. Con otro rol, el RolesGuard responde 403 antes de leer
// parámetros o cuerpo, así que basta un id cualquiera.
const ENDPOINTS: [Metodo, string][] = [
  ['get', '/api/juridico/audiencias'],
  ['get', '/api/juridico/audiencias/disponibilidad'],
  ['get', `/api/juridico/procesos/${ID}/audiencias`],
  ['post', `/api/juridico/procesos/${ID}/audiencias`],
  ['post', `/api/juridico/audiencias/${ID}/reprogramacion`],
  ['post', `/api/juridico/audiencias/${ID}/cancelacion`],
  ['patch', `/api/juridico/audiencias/${ID}/responsable`],
  ['post', `/api/juridico/audiencias/${ID}/resultado`],
  ['patch', `/api/juridico/audiencias/${ID}/observaciones`],
  ['post', `/api/juridico/audiencias/${ID}/documentos`],
];
const OTROS_ROLES: Rol[] = [
  'TRABAJO_SOCIAL',
  'PSICOLOGIA',
  'MEDICA',
  'ADMINISTRACION',
];

/** "YYYY-MM-DDTHH:mm" en hora de Guatemala, como lo manda el formulario. */
function fechaHoraGT(instante: Date): string {
  return `${fechaCalendarioGT(instante)}T${horaGT(instante)}`;
}

describe('Jurídico · acceso a audiencias (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let juridico: Usuario;
  let sesionJuridico: Sesion;
  let trabajoSocial: Usuario;
  const sesiones = new Map<Rol, Sesion>();

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

  function pedir(metodo: Metodo, ruta: string, sesion = sesionJuridico) {
    return request(app.getHttpServer())
      [metodo](ruta)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf);
  }

  /** Proceso abierto de una usuaria referida (o no) a Jurídico, con su abogada. */
  async function escenario(referidoA: Rol[] = ['JURIDICO']) {
    const { expediente } = await crearExpediente(
      prisma,
      trabajoSocial.id,
      referidoA,
    );
    const proceso = await crearProceso(prisma, expediente.id, juridico.id);
    const abogada = await crearAbogada(prisma);
    return { expediente, proceso, abogada };
  }

  function audienciaEnBase(
    procesoId: string,
    responsable: Personal,
    datos: { inicio?: Date; estado?: 'PROGRAMADA' | 'REALIZADA' } = {},
  ) {
    const conResultado = datos.estado === 'REALIZADA';
    return prisma.audienciaJuridica.create({
      data: {
        procesoId,
        responsableId: responsable.id,
        inicio: datos.inicio ?? instanteFuturo(),
        estado: datos.estado ?? 'PROGRAMADA',
        resultadoEn: conResultado ? new Date() : null,
        descripcion: `${MARCA} audiencia`,
        observaciones: conResultado ? `${MARCA} observaciones` : null,
        creadoPorId: juridico.id,
      },
    });
  }

  describe('otro rol', () => {
    it.each(
      OTROS_ROLES.flatMap((rol) =>
        ENDPOINTS.map(([metodo, ruta]) => [rol, metodo, ruta] as const),
      ),
    )('%s → %s %s responde 403', async (rol, metodo, ruta) => {
      // Sin fallback a la sesión de Jurídico: un rol sin sesión rompe la prueba, no la aprueba.
      const sesionRol = sesiones.get(rol);
      if (!sesionRol) throw new Error(`Sin sesión para ${rol}`);
      await pedir(metodo, ruta, sesionRol).expect(403);
    });

    it('sin sesión responde 401', async () => {
      await request(app.getHttpServer())
        .get('/api/juridico/audiencias')
        .expect(401);
    });
  });

  describe('expediente no referido a Jurídico', () => {
    let ajeno: Awaited<ReturnType<typeof escenario>>;
    let audienciaId: string;
    let inicio: Date;

    beforeAll(async () => {
      ajeno = await escenario(['PSICOLOGIA']);
      inicio = instanteFuturo();
      audienciaId = (
        await audienciaEnBase(ajeno.proceso.id, ajeno.abogada, { inicio })
      ).id;
    });

    it('no se listan ni se agendan audiencias en su proceso', async () => {
      await pedir(
        'get',
        `/api/juridico/procesos/${ajeno.proceso.id}/audiencias`,
      ).expect(403);
      await pedir(
        'post',
        `/api/juridico/procesos/${ajeno.proceso.id}/audiencias`,
      )
        .send({
          fechaHora: fechaHoraGT(instanteFuturo()),
          responsableId: ajeno.abogada.id,
        })
        .expect(403);
      expect(
        await prisma.audienciaJuridica.count({
          where: { procesoId: ajeno.proceso.id },
        }),
      ).toBe(1);
    });

    it.each([
      [
        'post',
        'reprogramacion',
        { fechaHora: '2030-01-07T10:00', motivo: 'x' },
      ],
      ['post', 'cancelacion', { motivo: 'x' }],
      ['patch', 'responsable', {}],
      ['post', 'resultado', { resultado: 'REALIZADA', observaciones: 'x' }],
    ] as const)(
      '%s audiencias/:id/%s responde 403 sin tocarla',
      async (metodo, accion, cuerpo) => {
        await pedir(metodo, `/api/juridico/audiencias/${audienciaId}/${accion}`)
          .send({ ...cuerpo, responsableId: ajeno.abogada.id, version: 1 })
          .expect(403);
        const audiencia = await prisma.audienciaJuridica.findUniqueOrThrow({
          where: { id: audienciaId },
        });
        expect(audiencia).toMatchObject({ estado: 'PROGRAMADA', version: 1 });
      },
    );

    it('no se le adjuntan documentos', async () => {
      await pedir('post', `/api/juridico/audiencias/${audienciaId}/documentos`)
        .attach('archivo', Buffer.from('%PDF-1.4 ficticio'), {
          filename: 'ficticio.pdf',
          contentType: 'application/pdf',
        })
        .expect(403);
      expect(
        await prisma.carpetaDocumentoProceso.count({
          where: { procesoId: ajeno.proceso.id },
        }),
      ).toBe(0);
    });

    it('no aparece en la sección Audiencias ni en la disponibilidad', async () => {
      const lista = await pedir('get', '/api/juridico/audiencias')
        .query({ q: ajeno.expediente.numero })
        .expect(200);
      expect(lista.body).toMatchObject({ items: [], total: 0 });

      const dia = await pedir('get', '/api/juridico/audiencias/disponibilidad')
        .query({
          responsableId: ajeno.abogada.id,
          fecha: fechaCalendarioGT(inicio),
        })
        .expect(200);
      expect((dia.body as DisponibilidadAudienciasDto).audiencias).toEqual([]);
    });
  });

  describe('controles: con el acceso correcto sí responde', () => {
    it('agenda, lista, reprograma y la vieja queda enlazada', async () => {
      const { expediente, proceso, abogada } = await escenario();
      const inicio = instanteFuturo();

      const respuestaAgenda = await pedir(
        'post',
        `/api/juridico/procesos/${proceso.id}/audiencias`,
      )
        .send({ fechaHora: fechaHoraGT(inicio), responsableId: abogada.id })
        .expect(201);
      const agendada = respuestaAgenda.body as AudienciaAgendadaDto;
      expect(agendada).toEqual({
        id: agendada.id,
        fecha: fechaCalendarioGT(inicio),
        hora: horaGT(inicio),
      });
      expect(
        await prisma.audienciaJuridica.count({ where: { id: agendada.id } }),
      ).toBe(1);

      const lista = (
        await pedir('get', '/api/juridico/audiencias')
          .query({ q: expediente.numero })
          .expect(200)
      ).body as AudienciasPaginadas;
      expect(lista.items).toHaveLength(1);
      expect(lista.items[0]).toMatchObject({
        id: agendada.id,
        estado: 'PROGRAMADA',
      });
      expect(lista.items[0].accionesDisponibles).toContain('REPROGRAMAR');
      expect(lista.items[0].accionesDisponibles).toContain('CANCELAR');

      const reprogramada = await pedir(
        'post',
        `/api/juridico/audiencias/${agendada.id}/reprogramacion`,
      )
        .send({
          fechaHora: fechaHoraGT(instanteFuturo()),
          responsableId: abogada.id,
          motivo: `${MARCA} motivo`,
          version: 1,
        })
        .expect(201);

      const delProceso = await pedir(
        'get',
        `/api/juridico/procesos/${proceso.id}/audiencias`,
      ).expect(200);
      const vieja = (delProceso.body as AudienciaDetalleDto[]).find(
        (a) => a.id === agendada.id,
      );
      expect(vieja).toMatchObject({
        estado: 'REPROGRAMADA',
        reprogramadaA: { id: (reprogramada.body as AudienciaAgendadaDto).id },
      });
    });

    it('registra el resultado de una que ya pasó y deja la bitácora', async () => {
      const { proceso, abogada } = await escenario();
      const pasada = await audienciaEnBase(proceso.id, abogada, {
        inicio: new Date(Math.floor(Date.now() / 60_000) * 60_000 - 3_600_000),
      });

      await pedir('post', `/api/juridico/audiencias/${pasada.id}/resultado`)
        .send({
          resultado: 'REALIZADA',
          observaciones: 'Dato ficticio: se presentaron ambas partes',
          version: 1,
        })
        .expect(204);

      const notas = await prisma.notaAvanceProceso.count({
        where: { procesoId: proceso.id },
      });
      expect(notas).toBe(1);
    });

    it('"Mías" solo trae las de la ficha enlazada a la cuenta', async () => {
      const { expediente, proceso } = await escenario();
      const propia = await prisma.personal.create({
        data: {
          area: 'JURIDICO',
          tipo: 'ABOGADA',
          nombre: `${MARCA} Abogada propia`,
          usuarioId: (await crearUsuario(prisma, 'JURIDICO')).id,
        },
      });
      const otra = await crearAbogada(prisma);
      await audienciaEnBase(proceso.id, propia);
      await audienciaEnBase(proceso.id, otra);

      const sesionPropia = sesionDe(
        app,
        await prisma.usuario.findUniqueOrThrow({
          where: { id: propia.usuarioId! },
        }),
      );
      const lista = (
        await pedir('get', '/api/juridico/audiencias', sesionPropia)
          .query({ q: expediente.numero, mias: 'true' })
          .expect(200)
      ).body as AudienciasPaginadas;
      expect(lista.items).toHaveLength(1);
      expect(lista.items[0].responsable.id).toBe(propia.id);
    });
  });
});
