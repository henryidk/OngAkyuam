import type { INestApplication } from '@nestjs/common';
import type { Personal, Prisma, Usuario } from '@prisma/client';
import { fechaCalendarioGT, horaGT } from '@akyuam/shared';
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

/**
 * Lo que decide la base y no un mock: el índice de una sola PROGRAMADA por responsable e
 * instante, el `@unique` de la nueva fecha, el bloqueo de la fila del proceso, los CHECK de la
 * migración de audiencias y que nada se borre en cascada.
 */
describe('Jurídico · restricciones de audiencias (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let juridico: Usuario;
  let sesion: Sesion;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    juridico = await crearUsuario(prisma, 'JURIDICO');
    sesion = sesionDe(app, juridico);
  });

  afterAll(async () => {
    await app.close();
  });

  function pedir(metodo: 'post' | 'patch', ruta: string) {
    return request(app.getHttpServer())
      [metodo](ruta)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf);
  }

  function fechaHoraGT(instante: Date): string {
    return `${fechaCalendarioGT(instante)}T${horaGT(instante)}`;
  }

  async function procesoAbierto(
    datos: Parameters<typeof crearProceso>[3] = {},
  ) {
    const { expediente } = await crearExpediente(prisma, juridico.id, [
      'JURIDICO',
    ]);
    return crearProceso(prisma, expediente.id, juridico.id, datos);
  }

  function audiencia(
    procesoId: string,
    responsable: Personal,
    datos: Partial<Prisma.AudienciaJuridicaUncheckedCreateInput> = {},
  ) {
    return prisma.audienciaJuridica.create({
      data: {
        procesoId,
        responsableId: responsable.id,
        inicio: instanteFuturo(),
        descripcion: `${MARCA} audiencia`,
        creadoPorId: juridico.id,
        ...datos,
      },
    });
  }

  function estados(respuestas: { status: number }[]): number[] {
    return respuestas.map((r) => r.status).sort();
  }

  describe('peticiones simultáneas', () => {
    it('dos agendas a la misma hora con la misma abogada: una sola gana', async () => {
      const [procesoA, procesoB] = [
        await procesoAbierto(),
        await procesoAbierto(),
      ];
      const abogada = await crearAbogada(prisma);
      const cuerpo = {
        fechaHora: fechaHoraGT(instanteFuturo()),
        responsableId: abogada.id,
      };

      const respuestas = await Promise.all(
        [procesoA, procesoB].map((p) =>
          pedir('post', `/api/juridico/procesos/${p.id}/audiencias`).send(
            cuerpo,
          ),
        ),
      );

      expect(estados(respuestas)).toEqual([201, 409]);
      expect(
        await prisma.audienciaJuridica.count({
          where: { responsableId: abogada.id },
        }),
      ).toBe(1);
    });

    it('dos "agendar nueva fecha" de la misma cancelada: una sola gana', async () => {
      const proceso = await procesoAbierto();
      const abogada = await crearAbogada(prisma);
      const cancelada = await audiencia(proceso.id, abogada, {
        estado: 'CANCELADA',
        origenCancelacion: 'MANUAL',
        motivo: `${MARCA} motivo`,
      });

      const respuestas = await Promise.all(
        [instanteFuturo(), instanteFuturo()].map((inicio) =>
          pedir('post', `/api/juridico/procesos/${proceso.id}/audiencias`).send(
            {
              fechaHora: fechaHoraGT(inicio),
              responsableId: abogada.id,
              reprogramadaDesdeId: cancelada.id,
            },
          ),
        ),
      );

      expect(estados(respuestas)).toEqual([201, 409]);
    });

    it('dos cancelaciones con la misma versión: la segunda es conflicto', async () => {
      const proceso = await procesoAbierto();
      const programada = await audiencia(
        proceso.id,
        await crearAbogada(prisma),
      );

      const respuestas = await Promise.all(
        [1, 2].map(() =>
          pedir(
            'post',
            `/api/juridico/audiencias/${programada.id}/cancelacion`,
          ).send({ motivo: `${MARCA} motivo`, version: 1 }),
        ),
      );

      expect(estados(respuestas)).toEqual([204, 409]);
      expect(
        await prisma.notaAvanceProceso.count({
          where: { procesoId: proceso.id },
        }),
      ).toBe(1);
    });
  });

  it('no se agenda en un proceso abandonado', async () => {
    const proceso = await procesoAbierto({ situacion: 'ABANDONADO' });
    await pedir('post', `/api/juridico/procesos/${proceso.id}/audiencias`)
      .send({
        fechaHora: fechaHoraGT(instanteFuturo()),
        responsableId: (await crearAbogada(prisma)).id,
      })
      .expect(409);
  });

  it('el No. judicial se captura solo si el proceso no lo tenía', async () => {
    const proceso = await procesoAbierto({ numeroJudicial: 'C-E2E-PREVIO' });
    await pedir('post', `/api/juridico/procesos/${proceso.id}/audiencias`)
      .send({
        fechaHora: fechaHoraGT(instanteFuturo()),
        responsableId: (await crearAbogada(prisma)).id,
        numeroJudicial: 'C-E2E-NUEVO',
      })
      .expect(201);
    const guardado = await prisma.procesoJuridico.findUniqueOrThrow({
      where: { id: proceso.id },
    });
    expect(guardado).toMatchObject({
      numeroJudicial: 'C-E2E-PREVIO',
      version: 1,
    });
  });

  describe('CHECK de la base', () => {
    let procesoId: string;
    let abogada: Personal;

    beforeAll(async () => {
      procesoId = (await procesoAbierto()).id;
      abogada = await crearAbogada(prisma);
    });

    it('la hora es un minuto exacto', async () => {
      const inicio = instanteFuturo();
      inicio.setUTCSeconds(30);
      await expect(audiencia(procesoId, abogada, { inicio })).rejects.toThrow();
    });

    it.each([
      ['cancelada sin origen', { estado: 'CANCELADA', motivo: 'x' }],
      [
        'cancelada sin motivo',
        { estado: 'CANCELADA', origenCancelacion: 'MANUAL' },
      ],
      [
        'no realizada sin motivo',
        { estado: 'NO_REALIZADA', resultadoEn: new Date() },
      ],
      ['realizada sin fecha de resultado', { estado: 'REALIZADA' }],
      ['programada con origen de cancelación', { origenCancelacion: 'MANUAL' }],
    ] as const)('rechaza una %s', async (_caso, datos) => {
      await expect(audiencia(procesoId, abogada, datos)).rejects.toThrow();
    });

    it('una audiencia no se reprograma desde sí misma', async () => {
      const creada = await audiencia(procesoId, abogada);
      await expect(
        prisma.audienciaJuridica.update({
          where: { id: creada.id },
          data: { reprogramadaDesdeId: creada.id },
        }),
      ).rejects.toThrow();
    });
  });

  it('un proceso con audiencias no se puede borrar, ni en cascada desde el expediente', async () => {
    const { expediente } = await crearExpediente(prisma, juridico.id, [
      'JURIDICO',
    ]);
    const proceso = await crearProceso(prisma, expediente.id, juridico.id);
    await audiencia(proceso.id, await crearAbogada(prisma));

    await expect(
      prisma.procesoJuridico.delete({ where: { id: proceso.id } }),
    ).rejects.toThrow();
    await expect(
      prisma.expediente.delete({ where: { id: expediente.id } }),
    ).rejects.toThrow();
    expect(
      await prisma.audienciaJuridica.count({
        where: { procesoId: proceso.id },
      }),
    ).toBe(1);
  });
});
