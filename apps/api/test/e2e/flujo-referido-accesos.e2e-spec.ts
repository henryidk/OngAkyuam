import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { TipoDocumento, Usuario } from '@prisma/client';
import type {
  ExpedienteDetalleArea,
  ExpedienteResumenArea,
} from '@akyuam/shared';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  crearApp,
  crearExpediente,
  crearUsuario,
  sesionDe,
  type Sesion,
} from './fixtures';

/**
 * Flujo completo de privacidad entre áreas: Trabajo Social registra, refiere con una
 * visibilidad concreta, el área ve solo eso, Trabajo Social cambia el acceso y el área deja
 * de verlo. Los archivos se insertan directo en la base (subirlos necesita R2) y nunca se
 * pide una URL firmada de un documento visible.
 */
describe('Flujo completo · referido y accesos entre áreas (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let trabajoSocial: Usuario;
  let sesionTs: Sesion;
  let sesionMedica: Sesion;
  let sesionPsicologia: Sesion;
  let sesionJuridico: Sesion;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    trabajoSocial = await crearUsuario(prisma, 'TRABAJO_SOCIAL');
    sesionTs = sesionDe(app, trabajoSocial);
    sesionMedica = sesionDe(app, await crearUsuario(prisma, 'MEDICA'));
    sesionPsicologia = sesionDe(app, await crearUsuario(prisma, 'PSICOLOGIA'));
    sesionJuridico = sesionDe(app, await crearUsuario(prisma, 'JURIDICO'));
  });

  afterAll(async () => {
    await app.close();
  });

  function get(ruta: string, sesion: Sesion) {
    return request(app.getHttpServer())
      .get(ruta)
      .set('Cookie', sesion.cookie)
      .set('X-CSRF-Token', sesion.csrf);
  }

  function enviar(metodo: 'post' | 'put', ruta: string, cuerpo: object) {
    return request(app.getHttpServer())
      [metodo](ruta)
      .set('Cookie', sesionTs.cookie)
      .set('X-CSRF-Token', sesionTs.csrf)
      .send(cuerpo);
  }

  /** Documento ficticio ya "subido" por Trabajo Social, sin visibilidad para nadie. */
  function documento(expedienteId: string, tipo: TipoDocumento) {
    return prisma.documento.create({
      data: {
        expedienteId,
        tipo,
        nombreArchivo: 'ficticio.pdf',
        claveR2: `e2e/${randomUUID()}`,
        mimeType: 'application/pdf',
        tamanioBytes: 1024,
        subidoPorId: trabajoSocial.id,
      },
    });
  }

  async function detalle(expedienteId: string, sesion: Sesion) {
    const respuesta = await get(
      `/api/areas/expedientes/${expedienteId}`,
      sesion,
    ).expect(200);
    return respuesta.body as ExpedienteDetalleArea;
  }

  async function idsListados(sesion: Sesion) {
    const respuesta = await get('/api/areas/expedientes', sesion).expect(200);
    return (respuesta.body as ExpedienteResumenArea[]).map((e) => e.id);
  }

  it('registrar → referir → ver solo lo permitido → cambiar acceso → dejar de verlo', async () => {
    // 1. Trabajo Social registra el caso y sube dos formularios. Aún no refiere a nadie.
    const { expediente } = await crearExpediente(prisma, trabajoSocial.id, []);
    const entrevista = await documento(expediente.id, 'ENTREVISTA_USUARIA');
    const acciones = await documento(expediente.id, 'ACCIONES_REALIZADAS');
    const rutaDetalle = `/api/areas/expedientes/${expediente.id}`;
    const urlDe = (documentoId: string) =>
      `${rutaDetalle}/documentos/${documentoId}/url`;

    // Sin referido, ninguna área lo ve: ni en su lista, ni el detalle, ni los archivos.
    for (const sesion of [sesionMedica, sesionPsicologia, sesionJuridico]) {
      expect(await idsListados(sesion)).not.toContain(expediente.id);
      await get(rutaDetalle, sesion).expect(403);
      await get(urlDe(entrevista.id), sesion).expect(403);
    }

    // 2. Refiere a Médica con los datos del caso y solo la entrevista.
    await enviar(
      'post',
      `/api/trabajo-social/expedientes/${expediente.id}/referidos`,
      {
        area: 'MEDICA',
        motivo: 'Dato ficticio',
        visibilidad: { datosCaso: true, documentos: ['ENTREVISTA_USUARIA'] },
      },
    ).expect(201);

    // 3. Médica ve el caso con los datos y únicamente la entrevista.
    expect(await idsListados(sesionMedica)).toContain(expediente.id);
    let vistaMedica = await detalle(expediente.id, sesionMedica);
    expect(vistaMedica.datosCaso).not.toBeNull();
    expect(vistaMedica.documentos.map((d) => d.id)).toEqual([entrevista.id]);
    await get(urlDe(acciones.id), sesionMedica).expect(403);

    // Referir a Médica no abre el caso a Psicología.
    expect(await idsListados(sesionPsicologia)).not.toContain(expediente.id);
    await get(rutaDetalle, sesionPsicologia).expect(403);

    // 4. Trabajo Social retira los datos del caso y la entrevista, y habilita las acciones.
    await enviar(
      'put',
      `/api/trabajo-social/expedientes/${expediente.id}/accesos/MEDICA`,
      {
        datosCaso: false,
        documentos: { ENTREVISTA_USUARIA: false, ACCIONES_REALIZADAS: true },
      },
    ).expect(200);

    // 5. Médica deja de ver lo retirado, de inmediato, y ve lo nuevo.
    vistaMedica = await detalle(expediente.id, sesionMedica);
    expect(vistaMedica.datosCaso).toBeNull();
    expect(vistaMedica.documentos.map((d) => d.id)).toEqual([acciones.id]);
    await get(urlDe(entrevista.id), sesionMedica).expect(403);

    // El cambio queda auditado sin nada identificable de la usuaria.
    const auditoria = await prisma.auditLog.findFirst({
      where: {
        usuarioId: trabajoSocial.id,
        accion: 'ACCESO_AREA_MODIFICADO',
        entidadId: expediente.id,
      },
    });
    expect(auditoria?.detalles).toEqual({
      area: 'MEDICA',
      datosCaso: false,
      documentos: { ENTREVISTA_USUARIA: false, ACCIONES_REALIZADAS: true },
    });
  });

  it('Jurídico ve todo lo de Trabajo Social al ser referido y no se le puede restringir', async () => {
    const { expediente } = await crearExpediente(prisma, trabajoSocial.id, []);
    const entrevista = await documento(expediente.id, 'ENTREVISTA_USUARIA');

    // Aunque se le envíe una visibilidad vacía, la política de Jurídico es acceso completo.
    await enviar(
      'post',
      `/api/trabajo-social/expedientes/${expediente.id}/referidos`,
      {
        area: 'JURIDICO',
        motivo: 'Dato ficticio',
        visibilidad: { datosCaso: false, documentos: [] },
      },
    ).expect(201);

    const vista = await detalle(expediente.id, sesionJuridico);
    expect(vista.datosCaso).not.toBeNull();
    expect(vista.documentos.map((d) => d.id)).toEqual([entrevista.id]);

    await enviar(
      'put',
      `/api/trabajo-social/expedientes/${expediente.id}/accesos/JURIDICO`,
      { datosCaso: false },
    ).expect(400);
  });

  it('no se cambia el acceso de un área a la que todavía no se refirió', async () => {
    const { expediente } = await crearExpediente(prisma, trabajoSocial.id, []);
    await enviar(
      'put',
      `/api/trabajo-social/expedientes/${expediente.id}/accesos/PSICOLOGIA`,
      { datosCaso: true },
    ).expect(400);
    await get(
      `/api/areas/expedientes/${expediente.id}`,
      sesionPsicologia,
    ).expect(403);
  });
});
