import { randomInt, randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Personal, Rol, Usuario } from '@prisma/client';
import {
  anioActualGT,
  etiquetaProceso,
  type AudienciasPaginadas,
  type ErrorNumeroJudicialRepetido,
  type ProcesoDetalle,
  type ProcesosPaginados,
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

type Metodo = 'get' | 'patch' | 'post';

const OTROS_ROLES: Rol[] = [
  'TRABAJO_SOCIAL',
  'PSICOLOGIA',
  'MEDICA',
  'ADMINISTRACION',
];

/** Número judicial ficticio y único por corrida. */
function numeroJudicialFicticio(): string {
  return `E2E-${randomUUID().slice(0, 8)}`;
}

describe('Jurídico · procesos: No. judicial, cartera, búsqueda y cierre (e2e)', () => {
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

  function expedienteReferido(referidoA: Rol[] = ['JURIDICO']) {
    return crearExpediente(prisma, trabajoSocial.id, referidoA);
  }

  function audienciaProgramada(procesoId: string, responsable: Personal) {
    return prisma.audienciaJuridica.create({
      data: {
        procesoId,
        responsableId: responsable.id,
        inicio: instanteFuturo(),
        descripcion: `${MARCA} audiencia`,
        creadoPorId: juridico.id,
      },
    });
  }

  async function listarProcesos(query: Record<string, string>) {
    const respuesta = await pedir('get', '/api/juridico/procesos')
      .query(query)
      .expect(200);
    return respuesta.body as ProcesosPaginados;
  }

  describe('No. judicial · acceso', () => {
    const ruta = `/api/juridico/procesos/${randomUUID()}/numero-judicial`;

    it.each(OTROS_ROLES)('%s → 403', async (rol) => {
      const sesionRol = sesiones.get(rol);
      if (!sesionRol) throw new Error(`Sin sesión para ${rol}`);
      await pedir('patch', ruta, sesionRol)
        .send({ numeroJudicial: 'X', version: 1 })
        .expect(403);
    });

    it('expediente no referido a Jurídico → 403 sin tocar el proceso', async () => {
      const { expediente } = await expedienteReferido(['PSICOLOGIA']);
      const proceso = await crearProceso(prisma, expediente.id, juridico.id);

      await pedir(
        'patch',
        `/api/juridico/procesos/${proceso.id}/numero-judicial`,
      )
        .send({ numeroJudicial: numeroJudicialFicticio(), version: 1 })
        .expect(403);

      const despues = await prisma.procesoJuridico.findUniqueOrThrow({
        where: { id: proceso.id },
      });
      expect(despues).toMatchObject({ numeroJudicial: null, version: 1 });
    });

    it('un id inexistente responde igual que uno sin acceso (403, sin IDOR)', async () => {
      await pedir('patch', ruta)
        .send({ numeroJudicial: numeroJudicialFicticio(), version: 1 })
        .expect(403);
    });
  });

  describe('No. judicial · flujo', () => {
    it('registra, avisa si está repetido y guarda al confirmar', async () => {
      const numero = numeroJudicialFicticio();
      const primero = await expedienteReferido();
      const otro = await crearProceso(
        prisma,
        primero.expediente.id,
        juridico.id,
        {
          numeroJudicial: numero,
        },
      );
      const segundo = await expedienteReferido();
      const proceso = await crearProceso(
        prisma,
        segundo.expediente.id,
        juridico.id,
      );
      const ruta = `/api/juridico/procesos/${proceso.id}/numero-judicial`;

      // Mismo número con otras mayúsculas: es el mismo expediente judicial.
      const repetido = await pedir('patch', ruta)
        .send({ numeroJudicial: numero.toLowerCase(), version: 1 })
        .expect(409);
      const cuerpo = repetido.body as ErrorNumeroJudicialRepetido;
      expect(cuerpo.codigo).toBe('NUMERO_JUDICIAL_REPETIDO');
      expect(cuerpo.detalle.procesos).toEqual([
        {
          id: otro.id,
          codigo: etiquetaProceso(primero.expediente.numero, 1),
          tipo: 'MEDIDAS_SEGURIDAD',
        },
      ]);
      expect(
        (
          await prisma.procesoJuridico.findUniqueOrThrow({
            where: { id: proceso.id },
          })
        ).numeroJudicial,
      ).toBeNull();

      await pedir('patch', ruta)
        .send({
          numeroJudicial: numero,
          version: 1,
          confirmarNumeroRepetido: true,
        })
        .expect(204);

      const guardado = await prisma.procesoJuridico.findUniqueOrThrow({
        where: { id: proceso.id },
      });
      expect(guardado).toMatchObject({ numeroJudicial: numero, version: 2 });
      const notas = await prisma.notaAvanceProceso.findMany({
        where: { procesoId: proceso.id },
      });
      expect(notas.map((n) => n.contenido)).toEqual([
        'Se registró el No. judicial del proceso',
      ]);

      // Con la versión vieja ya no se pisa.
      await pedir('patch', ruta)
        .send({ numeroJudicial: numeroJudicialFicticio(), version: 1 })
        .expect(409);
    });

    it('la auditoría nunca guarda el número', async () => {
      const numero = numeroJudicialFicticio();
      const { expediente } = await expedienteReferido();
      const proceso = await crearProceso(prisma, expediente.id, juridico.id);

      await pedir(
        'patch',
        `/api/juridico/procesos/${proceso.id}/numero-judicial`,
      )
        .send({ numeroJudicial: numero, version: 1 })
        .expect(204);

      const eventos = await prisma.auditLog.findMany({
        where: { entidadId: proceso.id, accion: 'PROCESO_NUMERO_JUDICIAL' },
      });
      expect(eventos).toHaveLength(1);
      expect(JSON.stringify(eventos)).not.toContain(numero);
    });
  });

  describe('búsqueda por No. interno completo (H1)', () => {
    /** Las E2E numeran "E2E-…"; aquí hace falta la forma real "NN-AAAA", única por corrida. */
    async function expedienteConNumeroReal(referidoA: Rol[] = ['JURIDICO']) {
      const { expediente } = await expedienteReferido(referidoA);
      const numero = `9${randomInt(10_000_000).toString().padStart(7, '0')}-2026`;
      return prisma.expediente.update({
        where: { id: expediente.id },
        data: { numero },
      });
    }

    it('"NN-AAAA · Proceso 2" encuentra solo ese proceso, en Procesos y en Audiencias', async () => {
      const expediente = await expedienteConNumeroReal();
      const abogada = await crearAbogada(prisma);
      const primero = await crearProceso(prisma, expediente.id, juridico.id);
      const segundo = await crearProceso(prisma, expediente.id, juridico.id, {
        consecutivo: 2,
      });
      await audienciaProgramada(primero.id, abogada);
      const audiencia = await audienciaProgramada(segundo.id, abogada);
      const termino = etiquetaProceso(expediente.numero, 2);

      const procesos = await listarProcesos({ q: termino });
      expect(procesos.items.map((p) => p.id)).toEqual([segundo.id]);
      expect(procesos.items[0].codigo).toBe(termino);

      const audiencias = (
        await pedir('get', '/api/juridico/audiencias')
          .query({ q: termino })
          .expect(200)
      ).body as AudienciasPaginadas;
      expect(audiencias.items.map((a) => a.id)).toEqual([audiencia.id]);

      // Solo el número de expediente sigue trayendo los dos.
      const ambos = await listarProcesos({ q: expediente.numero });
      expect(ambos.items.map((p) => p.id).sort()).toEqual(
        [primero.id, segundo.id].sort(),
      );
    });

    it('no se salta el acceso: un expediente no referido no aparece', async () => {
      const expediente = await expedienteConNumeroReal(['PSICOLOGIA']);
      await crearProceso(prisma, expediente.id, juridico.id, {
        consecutivo: 2,
      });

      const procesos = await listarProcesos({
        q: etiquetaProceso(expediente.numero, 2),
      });
      expect(procesos).toMatchObject({ items: [], total: 0 });
    });
  });

  describe('cartera', () => {
    it('el filtro en SQL coincide con esSeguimiento de cada fila (misma regla en ambos lados)', async () => {
      const anio = anioActualGT();
      const { expediente } = await expedienteReferido();
      const casos = [
        { fechaInicio: `${anio}-01-01`, situacion: 'ACTIVO' },
        { fechaInicio: `${anio - 1}-12-31`, situacion: 'ACTIVO' },
        { fechaInicio: `${anio - 2}-06-15`, situacion: 'ACTIVO' },
      ] as const;
      const ids: string[] = [];
      for (const [i, caso] of casos.entries()) {
        const proceso = await crearProceso(prisma, expediente.id, juridico.id, {
          consecutivo: i + 1,
          fechaInicio: new Date(caso.fechaInicio),
          situacion: caso.situacion,
        });
        ids.push(proceso.id);
      }

      const todos = await listarProcesos({ q: expediente.numero });
      const anioActual = await listarProcesos({
        q: expediente.numero,
        cartera: 'ANIO',
      });
      const seguimiento = await listarProcesos({
        q: expediente.numero,
        cartera: 'SEGUIMIENTO',
      });

      expect(todos.items.map((p) => p.id).sort()).toEqual([...ids].sort());
      expect(seguimiento.items.map((p) => p.id).sort()).toEqual(
        todos.items
          .filter((p) => p.esSeguimiento)
          .map((p) => p.id)
          .sort(),
      );
      expect(anioActual.items.map((p) => p.id).sort()).toEqual(
        todos.items
          .filter((p) => !p.esSeguimiento)
          .map((p) => p.id)
          .sort(),
      );
      expect(seguimiento.items.map((p) => p.id).sort()).toEqual(
        [ids[1], ids[2]].sort(),
      );
    });

    it('una cartera que no existe → 400', async () => {
      await pedir('get', '/api/juridico/procesos')
        .query({ cartera: 'OTRA' })
        .expect(400);
    });
  });

  describe('cerrar un proceso cancela sus audiencias programadas', () => {
    it.each([
      [
        'finalizacion',
        'PROCESO_FINALIZADO',
        'cancelada por finalización del proceso',
        {
          forma: 'SENTENCIA',
          detalle: '',
          fechaCierre: '2026-02-01',
          version: 1,
        },
      ],
      [
        'abandono',
        'PROCESO_ABANDONADO',
        'cancelada por abandono del proceso',
        {
          motivoCatalogo: 'NO_RESPONDE',
          observaciones: '',
          ultimoContacto: '',
          intentos: 0,
          notificarTs: false,
          version: 1,
        },
      ],
    ] as const)(
      'al registrar la %s pasan a CANCELADA con su origen, bitácora y auditoría',
      async (accion, origen, textoBitacora, cuerpo) => {
        const { expediente } = await expedienteReferido();
        const abogada = await crearAbogada(prisma);
        const proceso = await crearProceso(prisma, expediente.id, juridico.id);
        const programadas = [
          await audienciaProgramada(proceso.id, abogada),
          await audienciaProgramada(proceso.id, abogada),
        ];
        const realizada = await prisma.audienciaJuridica.create({
          data: {
            procesoId: proceso.id,
            responsableId: abogada.id,
            inicio: new Date('2026-01-20T15:00:00.000Z'),
            estado: 'REALIZADA',
            resultadoEn: new Date('2026-01-20T17:00:00.000Z'),
            creadoPorId: juridico.id,
          },
        });

        // El detalle avisa antes de confirmar cuáles se cancelarían.
        const detalle = (
          await pedir('get', `/api/juridico/procesos/${proceso.id}`).expect(200)
        ).body as ProcesoDetalle;
        expect(detalle.audienciasProgramadas.map((a) => a.id).sort()).toEqual(
          programadas.map((a) => a.id).sort(),
        );
        expect(detalle.proximaAudiencia).not.toBeNull();

        await pedir('post', `/api/juridico/procesos/${proceso.id}/${accion}`)
          .send(cuerpo)
          .expect(204);

        const audiencias = await prisma.audienciaJuridica.findMany({
          where: { procesoId: proceso.id },
        });
        for (const programada of programadas) {
          expect(audiencias.find((a) => a.id === programada.id)).toMatchObject({
            estado: 'CANCELADA',
            origenCancelacion: origen,
            version: 2,
          });
        }
        // La que ya tenía resultado no se toca.
        expect(audiencias.find((a) => a.id === realizada.id)).toMatchObject({
          estado: 'REALIZADA',
          origenCancelacion: null,
          version: 1,
        });

        const notas = await prisma.notaAvanceProceso.findMany({
          where: { procesoId: proceso.id },
        });
        expect(
          notas.filter((n) => n.contenido.endsWith(textoBitacora)),
        ).toHaveLength(2);

        const auditadas = await prisma.auditLog.findMany({
          where: {
            accion: 'AUDIENCIA_CANCELADA',
            entidadId: { in: programadas.map((a) => a.id) },
          },
        });
        expect(auditadas).toHaveLength(2);
        for (const evento of auditadas) {
          expect(evento.detalles).toEqual({ procesoId: proceso.id, origen });
        }

        const despues = (
          await pedir('get', `/api/juridico/procesos/${proceso.id}`).expect(200)
        ).body as ProcesoDetalle;
        expect(despues.audienciasProgramadas).toEqual([]);
        expect(despues.proximaAudiencia).toBeNull();
      },
    );

    it('al reactivar no se restauran', async () => {
      const { expediente } = await expedienteReferido();
      const abogada = await crearAbogada(prisma);
      const proceso = await crearProceso(prisma, expediente.id, juridico.id);
      const audiencia = await audienciaProgramada(proceso.id, abogada);

      await pedir('post', `/api/juridico/procesos/${proceso.id}/abandono`)
        .send({
          motivoCatalogo: 'NO_RESPONDE',
          observaciones: '',
          ultimoContacto: '',
          intentos: 0,
          notificarTs: false,
          version: 1,
        })
        .expect(204);
      await pedir('post', `/api/juridico/procesos/${proceso.id}/reactivacion`)
        .send({ version: 2 })
        .expect(204);

      expect(
        await prisma.audienciaJuridica.findUniqueOrThrow({
          where: { id: audiencia.id },
        }),
      ).toMatchObject({
        estado: 'CANCELADA',
        origenCancelacion: 'PROCESO_ABANDONADO',
      });
    });
  });
});
