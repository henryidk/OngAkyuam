import type { INestApplication } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type { App } from 'supertest/types';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { procesoAbiertoDePersona } from '../../src/psicologia/repositories/acceso-expediente';
import {
  MARCA,
  crearApp,
  crearExpediente,
  crearNino,
  crearUsuario,
  sesionDe,
} from './fixtures';

/**
 * Identidad estable de hijos/as (migraciones `hijos_identidad_estable` y
 * `psicologia_proceso_abierto_por_hijo`): cada hijo/a existe una vez, ligado a su madre, y cada
 * caso solo lo enlaza. Lo que se prueba aquí es de privacidad e integridad: nunca se enlaza al
 * hijo/a de otra usuaria, y un hijo/a no tiene dos procesos de psicología abiertos.
 */
describe('Hijos/as con identidad estable (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ts: Usuario;
  let psicologa: Usuario;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    ts = await crearUsuario(prisma, 'TRABAJO_SOCIAL');
    psicologa = await crearUsuario(prisma, 'PSICOLOGIA');
  });

  afterAll(async () => {
    await app.close();
  });

  /** Segundo expediente de la misma usuaria (el fixture crea usuaria y expediente juntos). */
  async function otroExpediente(usuariaId: string) {
    return prisma.expediente.create({
      data: {
        condicionMaternidad: 'NORMAL',
        idiomaAtencion: 'QEQCHI',
        numero: `E2E-${Math.random().toString(16).slice(2, 10)}`,
        usuariaId,
        fecha: new Date('2026-02-01'),
        tipoRegistro: 'INTERNA',
        fechaIngresoAlbergue: new Date('2026-02-01'),
        tipologiaDelito: ['PSICOLOGICA'],
        creadoPorId: ts.id,
      },
    });
  }

  function proceso(expedienteId: string, ninoId: string) {
    return prisma.atencionPsicologica.create({
      data: { expedienteId, ninoId, actualizadoPorId: psicologa.id },
    });
  }

  /** Body de "caso nuevo para una usuaria existente", Interna para poder llevar hijos/as. */
  function casoNuevo(ninos: Record<string, unknown>[]) {
    return {
      fecha: '2026-03-01',
      tipologiaDelito: ['PSICOLOGICA'],
      tipoRegistro: 'INTERNA',
      condicionMaternidad: 'NORMAL',
      idiomaAtencion: 'QEQCHI',
      fechaIngresoAlbergue: '2026-03-01',
      datosAgresor: { nombres: '', apellidos: '', telefono: '', direccion: '' },
      observaciones: '',
      ninos,
    };
  }

  function crearCaso(usuariaId: string, body: object) {
    const sesion = sesionDe(app, ts);
    return request(app.getHttpServer())
      .post(`/api/trabajo-social/usuarias/${usuariaId}/expedientes`)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf)
      .send(body);
  }

  describe('la base', () => {
    it('rechaza enlazar a un caso el hijo/a de otra usuaria', async () => {
      const a = await crearExpediente(prisma, ts.id, []);
      const b = await crearExpediente(prisma, ts.id, []);
      const ninoDeA = await crearNino(prisma, a.expediente.id);

      await expect(
        prisma.nino.create({
          data: { expedienteId: b.expediente.id, hijoId: ninoDeA.hijoId },
        }),
      ).rejects.toThrow();
    });

    it('no deja cambiar quién es el hijo/a de un enlace', async () => {
      const { expediente } = await crearExpediente(prisma, ts.id, []);
      const uno = await crearNino(prisma, expediente.id);
      const otro = await crearNino(prisma, expediente.id);

      await expect(
        prisma.nino.update({
          where: { id: uno.id },
          data: { hijoId: otro.hijoId },
        }),
      ).rejects.toThrow(/no se cambia por otro/);
    });

    it('llena la copia del hijo/a en el proceso, aunque la app no la envíe', async () => {
      const { expediente } = await crearExpediente(prisma, ts.id, []);
      const nino = await crearNino(prisma, expediente.id);

      const creado = await proceso(expediente.id, nino.id);

      expect(creado.hijoId).toBe(nino.hijoId);
    });

    it('un hijo/a con proceso abierto en un expediente no recibe otro en el siguiente', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      const enCaso1 = await crearNino(prisma, expediente.id);
      const expediente2 = await otroExpediente(usuaria.id);
      const enCaso2 = await prisma.nino.create({
        data: { expedienteId: expediente2.id, hijoId: enCaso1.hijoId },
      });
      await proceso(expediente.id, enCaso1.id);

      await expect(proceso(expediente2.id, enCaso2.id)).rejects.toThrow(
        /Unique constraint/,
      );
    });

    it('cerrado el primero, el hijo/a sí puede abrir otro en el siguiente expediente', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      const enCaso1 = await crearNino(prisma, expediente.id);
      const expediente2 = await otroExpediente(usuaria.id);
      const enCaso2 = await prisma.nino.create({
        data: { expedienteId: expediente2.id, hijoId: enCaso1.hijoId },
      });
      const primero = await proceso(expediente.id, enCaso1.id);
      await prisma.atencionPsicologica.update({
        where: { id: primero.id },
        data: {
          estado: 'CIERRE',
          fechaCierre: new Date(),
          motivoCierreCatalogo: 'OBJETIVOS_CUMPLIDOS',
        },
      });

      await expect(proceso(expediente2.id, enCaso2.id)).resolves.toBeTruthy();
    });
  });

  describe('la condición "proceso abierto de la persona"', () => {
    it('encuentra el proceso del hijo/a abierto en otro de los expedientes de la madre', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      const enCaso1 = await crearNino(prisma, expediente.id);
      const expediente2 = await otroExpediente(usuaria.id);
      const enCaso2 = await prisma.nino.create({
        data: { expedienteId: expediente2.id, hijoId: enCaso1.hijoId },
      });
      const abierto = await proceso(expediente.id, enCaso1.id);

      const encontrado = await prisma.atencionPsicologica.findFirst({
        where: procesoAbiertoDePersona({
          usuariaId: usuaria.id,
          ninoId: enCaso2.id,
        }),
        select: { id: true },
      });

      expect(encontrado?.id).toBe(abierto.id);
    });
  });

  describe('Trabajo Social registra un caso nuevo', () => {
    it('con un hijo/a ya conocido, lo enlaza sin duplicarlo y guarda la corrección', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      const previo = await crearNino(prisma, expediente.id);

      const respuesta = await crearCaso(
        usuaria.id,
        casoNuevo([
          {
            hijoId: previo.hijoId,
            nombres: MARCA,
            apellidos: 'Apellido Corregido',
            fechaNacimiento: '2018-01-01',
            genero: 'M',
          },
        ]),
      );

      expect(respuesta.status).toBe(201);
      const hijos = await prisma.hijoUsuaria.findMany({
        where: { usuariaId: usuaria.id },
        include: { casos: true },
      });
      expect(hijos).toHaveLength(1);
      expect(hijos[0].id).toBe(previo.hijoId);
      expect(hijos[0].apellidos).toBe('Apellido Corregido');
      expect(hijos[0].casos.map((caso) => caso.expedienteId).sort()).toEqual(
        [expediente.id, (respuesta.body as { id: string }).id].sort(),
      );
    });

    it('con un hijo/a nuevo, lo crea ligado a la usuaria', async () => {
      const { usuaria } = await crearExpediente(prisma, ts.id, []);

      const respuesta = await crearCaso(
        usuaria.id,
        casoNuevo([
          {
            nombres: MARCA,
            apellidos: 'Nuevo',
            fechaNacimiento: '2019-05-05',
            genero: 'H',
          },
        ]),
      );

      expect(respuesta.status).toBe(201);
      await expect(
        prisma.hijoUsuaria.count({ where: { usuariaId: usuaria.id } }),
      ).resolves.toBe(1);
    });

    it('con el hijo/a de otra usuaria responde 400 y no crea nada', async () => {
      const ajena = await crearExpediente(prisma, ts.id, []);
      const hijoAjeno = await crearNino(prisma, ajena.expediente.id);
      const { usuaria } = await crearExpediente(prisma, ts.id, []);
      const casosAntes = await prisma.expediente.count({
        where: { usuariaId: usuaria.id },
      });

      const respuesta = await crearCaso(
        usuaria.id,
        casoNuevo([
          {
            hijoId: hijoAjeno.hijoId,
            nombres: MARCA,
            apellidos: 'Intento',
            fechaNacimiento: '2018-01-01',
            genero: 'M',
          },
        ]),
      );

      expect(respuesta.status).toBe(400);
      await expect(
        prisma.expediente.count({ where: { usuariaId: usuaria.id } }),
      ).resolves.toBe(casosAntes);
      // Los datos del hijo/a ajeno siguen intactos.
      const intacto = await prisma.hijoUsuaria.findUniqueOrThrow({
        where: { id: hijoAjeno.hijoId },
      });
      expect(intacto.apellidos).not.toBe('Intento');
    });

    it('con el mismo hijo/a dos veces responde 400', async () => {
      const { usuaria, expediente } = await crearExpediente(prisma, ts.id, []);
      const previo = await crearNino(prisma, expediente.id);
      const nino = {
        hijoId: previo.hijoId,
        nombres: MARCA,
        apellidos: 'Doble',
        fechaNacimiento: '2018-01-01',
        genero: 'M',
      };

      const respuesta = await crearCaso(usuaria.id, casoNuevo([nino, nino]));

      expect(respuesta.status).toBe(400);
    });
  });
});
