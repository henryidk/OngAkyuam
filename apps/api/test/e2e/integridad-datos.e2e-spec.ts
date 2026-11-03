import { randomInt } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type { App } from 'supertest/types';
import request from 'supertest';
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
} from './fixtures';

/**
 * Integridad de los datos compartidos (migración `integridad_datos_compartidos`): la base
 * rechaza por sí sola lo que la app ya no debería escribir, aunque llegue por SQL directo, un
 * seed o un error de código. Cada prueba intenta romper una regla y espera el error.
 */
describe('Integridad de los datos compartidos (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ts: Usuario;
  let juridico: Usuario;
  let psicologa: Usuario;
  let medica: Usuario;
  let admin: Usuario;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    ts = await crearUsuario(prisma, 'TRABAJO_SOCIAL');
    juridico = await crearUsuario(prisma, 'JURIDICO');
    psicologa = await crearUsuario(prisma, 'PSICOLOGIA');
    medica = await crearUsuario(prisma, 'MEDICA');
    admin = await crearUsuario(prisma, 'ADMINISTRACION');
  });

  afterAll(async () => {
    await app.close();
  });

  function fichaDe(area: 'JURIDICO' | 'PSICOLOGIA', tipo: string) {
    return prisma.personal.create({
      data: { area, tipo, nombre: `${MARCA} Ficha ${randomInt(1_000_000)}` },
    });
  }

  describe('formato y valores', () => {
    it.each(['E2E-1', '5-2026', '05-26', '05-2026.01', ' 05-2026'])(
      'rechaza el número de expediente "%s"',
      async (numero) => {
        const { expediente } = await crearExpediente(prisma, ts.id, []);
        await expect(
          prisma.expediente.update({
            where: { id: expediente.id },
            data: { numero },
          }),
        ).rejects.toThrow(/Expediente_numero_formato_chk/);
      },
    );

    it('acepta un número de expediente de tres dígitos', async () => {
      const { expediente } = await crearExpediente(prisma, ts.id, []);
      const numero = `${randomInt(100_000_000, 999_999_999)}-2099`;
      await expect(
        prisma.expediente.update({
          where: { id: expediente.id },
          data: { numero },
        }),
      ).resolves.toMatchObject({ numero });
    });

    it('rechaza un contador de expedientes negativo', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO "ExpedienteContador" (anio, ultimo) VALUES (1901, -1)`,
      ).rejects.toThrow(/ExpedienteContador_ultimo_chk/);
    });

    it.each(['', '   '])(
      'rechaza una ficha de personal con cargo vacío ("%s")',
      async (tipo) => {
        await expect(fichaDe('JURIDICO', tipo)).rejects.toThrow(
          /Personal_tipo_chk/,
        );
      },
    );
  });

  describe('cierre de Psicología en los dos sentidos', () => {
    async function procesoPsicologia() {
      const { expediente } = await crearExpediente(prisma, ts.id, [
        'PSICOLOGIA',
      ]);
      return prisma.atencionPsicologica.create({
        data: {
          expedienteId: expediente.id,
          actualizadoPorId: psicologa.id,
          psicologaAsignadaId: psicologa.id,
        },
      });
    }

    it('un proceso en CIERRE necesita fecha y motivo de cierre', async () => {
      const proceso = await procesoPsicologia();
      await expect(
        prisma.atencionPsicologica.update({
          where: { id: proceso.id },
          data: { estado: 'CIERRE' },
        }),
      ).rejects.toThrow(/AtencionPsicologica_cierre_chk/);
    });

    it('un proceso abierto no puede tener datos de cierre', async () => {
      const proceso = await procesoPsicologia();
      await expect(
        prisma.atencionPsicologica.update({
          where: { id: proceso.id },
          data: {
            fechaCierre: new Date(),
            motivoCierreCatalogo: 'OBJETIVOS_CUMPLIDOS',
          },
        }),
      ).rejects.toThrow(/AtencionPsicologica_cierre_chk/);
    });
  });

  describe('asignaciones', () => {
    async function procesoJuridico() {
      const { expediente } = await crearExpediente(prisma, ts.id, ['JURIDICO']);
      return crearProceso(prisma, expediente.id, juridico.id);
    }

    it('la abogada del proceso no puede ser una procuradora', async () => {
      const proceso = await procesoJuridico();
      const procuradora = await fichaDe('JURIDICO', 'PROCURADORA');
      await expect(
        prisma.procesoJuridico.update({
          where: { id: proceso.id },
          data: { abogadaId: procuradora.id },
        }),
      ).rejects.toThrow(/abogada de Jurídico/);
    });

    it('la procuradora del proceso no puede ser una abogada', async () => {
      const proceso = await procesoJuridico();
      const abogada = await crearAbogada(prisma);
      await expect(
        prisma.procesoJuridico.update({
          where: { id: proceso.id },
          data: { procuradoraId: abogada.id },
        }),
      ).rejects.toThrow(/procuradora de Jurídico/);
    });

    it('acepta abogada y procuradora en su lugar', async () => {
      const proceso = await procesoJuridico();
      const abogada = await crearAbogada(prisma);
      const procuradora = await fichaDe('JURIDICO', 'PROCURADORA');
      await expect(
        prisma.procesoJuridico.update({
          where: { id: proceso.id },
          data: { abogadaId: abogada.id, procuradoraId: procuradora.id },
        }),
      ).resolves.toBeDefined();
    });

    it('la responsable de una audiencia no puede ser personal de otra área', async () => {
      const proceso = await procesoJuridico();
      const deOtraArea = await fichaDe('PSICOLOGIA', 'PSICOLOGA');
      await expect(
        prisma.audienciaJuridica.create({
          data: {
            procesoId: proceso.id,
            responsableId: deOtraArea.id,
            inicio: instanteFuturo(),
            descripcion: `${MARCA} audiencia`,
            creadoPorId: juridico.id,
          },
        }),
      ).rejects.toThrow(/abogada o procuradora de Jurídico/);
    });

    it('un proceso de Psicología no se asigna a una cuenta de Médica', async () => {
      const { expediente } = await crearExpediente(prisma, ts.id, [
        'PSICOLOGIA',
      ]);
      await expect(
        prisma.atencionPsicologica.create({
          data: {
            expedienteId: expediente.id,
            actualizadoPorId: psicologa.id,
            psicologaAsignadaId: medica.id,
          },
        }),
      ).rejects.toThrow(/cuenta de Psicología/);
    });

    it('una atención médica no se asigna a una cuenta de Psicología', async () => {
      const { expediente } = await crearExpediente(prisma, ts.id, ['MEDICA']);
      await expect(
        prisma.atencionMedica.create({
          data: {
            expedienteId: expediente.id,
            consecutivo: 1,
            fechaInicio: new Date('2026-01-02'),
            creadoPorId: medica.id,
            medicaId: psicologa.id,
          },
        }),
      ).rejects.toThrow(/cuenta de Médica/);
    });
  });

  describe('cuenta y ficha de personal enlazadas', () => {
    /** Cuenta de Jurídico enlazada a una ficha de abogada recién creada. */
    async function cuentaConFicha() {
      const cuenta = await crearUsuario(prisma, 'JURIDICO');
      const ficha = await crearAbogada(prisma);
      await prisma.personal.update({
        where: { id: ficha.id },
        data: { usuarioId: cuenta.id },
      });
      return { cuenta, ficha };
    }

    function comoAdmin(metodo: 'patch', ruta: string) {
      const sesion = sesionDe(app, admin);
      return request(app.getHttpServer())
        [metodo](ruta)
        .set('Cookie', sesion.cookie)
        .set('X-CSRF-Token', sesion.csrf);
    }

    it('al enlazar, la ficha toma el nombre de la cuenta', async () => {
      const { cuenta, ficha } = await cuentaConFicha();
      const enlazada = await prisma.personal.findUniqueOrThrow({
        where: { id: ficha.id },
      });
      expect(enlazada.nombre).toBe(cuenta.nombreCompleto);
    });

    it('renombrar la cuenta desde Usuarios cambia el nombre de la ficha', async () => {
      const { cuenta, ficha } = await cuentaConFicha();
      const nombreNuevo = `${MARCA} Renombrada ${randomInt(1_000_000)}`;

      const respuesta = await comoAdmin(
        'patch',
        `/api/administracion/usuarios/${cuenta.id}`,
      ).send({
        nombreCompleto: nombreNuevo,
        telefono: '12345678',
        dpi: String(randomInt(1_000_000, 9_999_999)).padStart(13, '9'),
        username: cuenta.username,
        sede: 'COBAN',
      });

      expect(respuesta.status).toBe(200);
      await expect(
        prisma.personal.findUniqueOrThrow({ where: { id: ficha.id } }),
      ).resolves.toMatchObject({ nombre: nombreNuevo });
    });

    it('desactivar la cuenta desactiva la ficha', async () => {
      const { cuenta, ficha } = await cuentaConFicha();

      const respuesta = await comoAdmin(
        'patch',
        `/api/administracion/usuarios/${cuenta.id}/desactivar`,
      ).send({});

      expect(respuesta.status).toBe(200);
      await expect(
        prisma.personal.findUniqueOrThrow({ where: { id: ficha.id } }),
      ).resolves.toMatchObject({ activo: false });
    });

    it.each([
      ['el nombre', { nombre: 'Otro nombre', activo: true }],
      ['el estado', { activo: false }],
    ])(
      'Personal no cambia %s de una ficha enlazada (409)',
      async (_campo, datos) => {
        const { cuenta, ficha } = await cuentaConFicha();

        const respuesta = await comoAdmin(
          'patch',
          `/api/personal/${ficha.id}`,
        ).send({ nombre: cuenta.nombreCompleto, ...datos });

        expect(respuesta.status).toBe(409);
        await expect(
          prisma.personal.findUniqueOrThrow({ where: { id: ficha.id } }),
        ).resolves.toMatchObject({
          nombre: cuenta.nombreCompleto,
          activo: true,
        });
      },
    );

    it('la base tampoco deja cambiar el nombre de una ficha enlazada', async () => {
      const { ficha } = await cuentaConFicha();
      await expect(
        prisma.personal.update({
          where: { id: ficha.id },
          data: { nombre: 'Otro nombre' },
        }),
      ).rejects.toThrow(/se cambian desde la cuenta/);
    });

    it('la base no deja enlazar una ficha a una cuenta de otra área', async () => {
      const ficha = await crearAbogada(prisma);
      await expect(
        prisma.personal.update({
          where: { id: ficha.id },
          data: { usuarioId: psicologa.id },
        }),
      ).rejects.toThrow(/otra área/);
    });

    it('no vincula una cuenta a una ficha inactiva (400)', async () => {
      const cuenta = await crearUsuario(prisma, 'JURIDICO');
      const ficha = await prisma.personal.create({
        data: {
          area: 'JURIDICO',
          tipo: 'ABOGADA',
          nombre: `${MARCA} Inactiva ${randomInt(1_000_000)}`,
          activo: false,
        },
      });

      const respuesta = await comoAdmin(
        'patch',
        `/api/administracion/usuarios/${cuenta.id}/ficha-personal`,
      ).send({ personalId: ficha.id });

      expect(respuesta.status).toBe(400);
      await expect(
        prisma.personal.findUniqueOrThrow({ where: { id: ficha.id } }),
      ).resolves.toMatchObject({ usuarioId: null });
    });

    it('una ficha libre se sigue editando desde Personal', async () => {
      const ficha = await crearAbogada(prisma);
      const nombre = `${MARCA} Libre ${randomInt(1_000_000)}`;

      const respuesta = await comoAdmin(
        'patch',
        `/api/personal/${ficha.id}`,
      ).send({ nombre, activo: false });

      expect(respuesta.status).toBe(200);
      await expect(
        prisma.personal.findUniqueOrThrow({ where: { id: ficha.id } }),
      ).resolves.toMatchObject({ nombre, activo: false });
    });
  });
});
