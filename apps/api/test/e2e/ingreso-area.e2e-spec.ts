import type { INestApplication } from '@nestjs/common';
import type { Rol, Usuario } from '@prisma/client';
import type { App } from 'supertest/types';
import request from 'supertest';
import type { ReferenciaBandejaDto } from '@akyuam/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  crearApp,
  crearExpediente,
  crearNino,
  crearUsuario,
  sesionDe,
  numeroExpedienteFicticio,
} from './fixtures';

/**
 * Ingreso por área (migración `ingreso_area`): la base escribe, por cada referencia, si es el
 * primer ingreso de la persona al área en toda su vida o un seguimiento. Las áreas solo lo leen.
 */
describe('Ingreso por área (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ts: Usuario;
  let psicologa: Usuario;
  let juridica: Usuario;
  let medica: Usuario;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    ts = await crearUsuario(prisma, 'TRABAJO_SOCIAL');
    psicologa = await crearUsuario(prisma, 'PSICOLOGIA');
    juridica = await crearUsuario(prisma, 'JURIDICO');
    medica = await crearUsuario(prisma, 'MEDICA');
  });

  afterAll(async () => {
    await app.close();
  });

  /** Otro expediente de la misma usuaria, sin referencias. */
  function otroExpediente(usuariaId: string) {
    return prisma.expediente.create({
      data: {
        condicionMaternidad: 'NORMAL',
        idiomaAtencion: 'QEQCHI',
        numero: numeroExpedienteFicticio(),
        usuariaId,
        fecha: new Date('2026-02-01'),
        tipoRegistro: 'EXTERNA',
        tipologiaDelito: ['PSICOLOGICA'],
        creadoPorId: ts.id,
      },
    });
  }

  function referir(expedienteId: string, area: Rol) {
    const sesion = sesionDe(app, ts);
    return request(app.getHttpServer())
      .post(`/api/trabajo-social/expedientes/${expedienteId}/referidos`)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf)
      .send({
        area,
        motivo: 'Dato ficticio',
        visibilidad: { datosCaso: true, documentos: [] },
      });
  }

  function ingresos(where: { usuariaId?: string; hijoId?: string | null }) {
    return prisma.ingresoArea.findMany({
      where,
      select: { area: true, ingreso: true, referidoId: true, hijoId: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  describe('la usuaria', () => {
    it('su primera referencia a un área es primer ingreso y la del caso siguiente, seguimiento', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      const expediente2 = await otroExpediente(usuaria.id);

      expect((await referir(expediente.id, 'JURIDICO')).status).toBe(201);
      expect((await referir(expediente2.id, 'JURIDICO')).status).toBe(201);

      const filas = await ingresos({ usuariaId: usuaria.id, hijoId: null });
      expect(filas.map((fila) => fila.ingreso)).toEqual([
        'PRIMER_INGRESO',
        'SEGUIMIENTO',
      ]);
    });

    it('referida a dos áreas el mismo día, es primer ingreso en cada una', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);

      expect((await referir(expediente.id, 'JURIDICO')).status).toBe(201);
      expect((await referir(expediente.id, 'PSICOLOGIA')).status).toBe(201);

      const filas = await ingresos({ usuariaId: usuaria.id });
      expect(filas.map((fila) => [fila.area, fila.ingreso]).sort()).toEqual([
        ['JURIDICO', 'PRIMER_INGRESO'],
        ['PSICOLOGIA', 'PRIMER_INGRESO'],
      ]);
    });

    it('dos referencias simultáneas al mismo área: solo una sale primer ingreso', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      const expediente2 = await otroExpediente(usuaria.id);
      const expediente3 = await otroExpediente(usuaria.id);

      await Promise.all(
        [expediente.id, expediente2.id, expediente3.id].map((expedienteId) =>
          prisma.referidoArea.create({
            data: { expedienteId, area: 'MEDICA', otorgadoPorId: ts.id },
          }),
        ),
      );

      const filas = await ingresos({ usuariaId: usuaria.id, hijoId: null });
      expect(filas).toHaveLength(3);
      expect(
        filas.filter((fila) => fila.ingreso === 'PRIMER_INGRESO'),
      ).toHaveLength(1);
    });

    it('Trabajo Social no es un área de atención: no genera ingreso', async () => {
      const { usuaria } = await crearExpediente(prisma, ts.id, [
        'TRABAJO_SOCIAL',
      ]);

      await expect(ingresos({ usuariaId: usuaria.id })).resolves.toEqual([]);
    });
  });

  describe('los hijos/as', () => {
    it('en Psicología: primer ingreso en el caso 1 y seguimiento en el caso 2', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, [
        'PSICOLOGIA',
      ]);
      const enCaso1 = await crearNino(prisma, expediente.id);
      const expediente2 = await otroExpediente(usuaria.id);
      await prisma.referidoArea.create({
        data: {
          expedienteId: expediente2.id,
          area: 'PSICOLOGIA',
          otorgadoPorId: ts.id,
        },
      });
      const enCaso2 = await prisma.nino.create({
        data: { expedienteId: expediente2.id, hijoId: enCaso1.hijoId },
      });

      const primero = await prisma.atencionPsicologica.create({
        data: {
          expedienteId: expediente.id,
          ninoId: enCaso1.id,
          actualizadoPorId: psicologa.id,
        },
      });
      await prisma.atencionPsicologica.update({
        where: { id: primero.id },
        data: {
          estado: 'CIERRE',
          fechaCierre: new Date(),
          motivoCierreCatalogo: 'OBJETIVOS_CUMPLIDOS',
        },
      });
      await prisma.atencionPsicologica.create({
        data: {
          expedienteId: expediente2.id,
          ninoId: enCaso2.id,
          actualizadoPorId: psicologa.id,
        },
      });

      const filas = await ingresos({ hijoId: enCaso1.hijoId });
      expect(filas.map((fila) => fila.ingreso)).toEqual([
        'PRIMER_INGRESO',
        'SEGUIMIENTO',
      ]);
      // La usuaria lleva su propio ingreso, aparte del de su hijo/a.
      const deLaUsuaria = await ingresos({
        usuariaId: usuaria.id,
        hijoId: null,
      });
      expect(deLaUsuaria.map((fila) => fila.ingreso)).toEqual([
        'PRIMER_INGRESO',
        'SEGUIMIENTO',
      ]);
    });

    it('en Médica: una sola fila por referencia aunque tenga varias consultas', async () => {
      const { expediente } = await crearExpediente(prisma, ts.id, ['MEDICA']);
      const nino = await crearNino(prisma, expediente.id);
      const atencion = await prisma.atencionMedica.create({
        data: {
          expedienteId: expediente.id,
          consecutivo: 1,
          fechaInicio: new Date('2026-01-02'),
          creadoPorId: medica.id,
        },
      });
      for (const hora of ['15', '16']) {
        await prisma.consultaMedica.create({
          data: {
            atencionId: atencion.id,
            ninoId: nino.id,
            fechaHora: new Date(`2026-01-02T${hora}:00:00.000Z`),
            diagnostico: 'Dato ficticio',
            atencionBrindada: 'Dato ficticio',
            registradaPorId: medica.id,
          },
        });
      }

      const filas = await ingresos({ hijoId: nino.hijoId });
      expect(filas).toEqual([
        expect.objectContaining({ area: 'MEDICA', ingreso: 'PRIMER_INGRESO' }),
      ]);
    });
  });

  describe('la base protege el dato', () => {
    it('no deja modificar un ingreso', async () => {
      const { usuaria } = await crearExpediente(prisma, ts.id, ['JURIDICO']);
      const [fila] = await prisma.ingresoArea.findMany({
        where: { usuariaId: usuaria.id },
      });

      await expect(
        prisma.ingresoArea.update({
          where: { id: fila.id },
          data: { ingreso: 'SEGUIMIENTO' },
        }),
      ).rejects.toThrow(/no se modifica/);
    });

    it('rechaza un ingreso con un área distinta a la de su referencia', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, [
        'JURIDICO',
      ]);

      await expect(
        prisma.ingresoArea.create({
          data: {
            referidoId: expediente.referidos[0].id,
            area: 'PSICOLOGIA',
            usuariaId: usuaria.id,
            ingreso: 'SEGUIMIENTO',
          },
        }),
      ).rejects.toThrow(/no coincide/);
    });

    it('rechaza un ingreso de la usuaria de otro expediente', async () => {
      const propio = await crearExpediente(prisma, ts.id, ['JURIDICO']);
      const ajena = await crearExpediente(prisma, ts.id, []);

      await expect(
        prisma.ingresoArea.create({
          data: {
            referidoId: propio.expediente.referidos[0].id,
            area: 'JURIDICO',
            usuariaId: ajena.usuaria.id,
            ingreso: 'SEGUIMIENTO',
          },
        }),
      ).rejects.toThrow(/no coincide/);
    });
  });

  describe('lectura por las áreas', () => {
    it('la bandeja de Jurídico muestra el ingreso, y solo de sus propias referencias', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, [
        'JURIDICO',
        'PSICOLOGIA',
      ]);
      const sesion = sesionDe(app, juridica);

      const respuesta = await request(app.getHttpServer())
        .get('/api/juridico/bandeja')
        .set('Cookie', sesion.cookie);

      expect(respuesta.status).toBe(200);
      const deLaUsuaria = (respuesta.body as ReferenciaBandejaDto[]).filter(
        (referencia) => referencia.usuaria.id === usuaria.id,
      );
      const juridicaRef = expediente.referidos.find(
        (referido) => referido.area === 'JURIDICO',
      );
      expect(deLaUsuaria).toEqual([
        expect.objectContaining({
          referidoId: juridicaRef?.id,
          ingreso: 'PRIMER_INGRESO',
        }),
      ]);
    });

    it('otra área no puede leer la bandeja de Jurídico', async () => {
      const sesion = sesionDe(app, psicologa);

      const respuesta = await request(app.getHttpServer())
        .get('/api/juridico/bandeja')
        .set('Cookie', sesion.cookie);

      expect(respuesta.status).toBe(403);
    });
  });
});
