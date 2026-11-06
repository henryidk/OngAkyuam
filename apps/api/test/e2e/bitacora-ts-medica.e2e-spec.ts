import type { INestApplication } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type { EventoBitacora } from '@akyuam/shared';
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

describe('Trabajo Social · bitácora con los eventos de Médica (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let medica: Usuario;
  let trabajoSocial: Usuario;
  let sesionTs: Sesion;

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    medica = await crearUsuario(prisma, 'MEDICA');
    trabajoSocial = await crearUsuario(prisma, 'TRABAJO_SOCIAL');
    sesionTs = sesionDe(app, trabajoSocial);
  });

  afterAll(async () => {
    await app.close();
  });

  function auditar(
    accion: string,
    entidad: string,
    entidadId: string,
    detalles: Record<string, unknown>,
  ) {
    return prisma.auditLog.create({
      data: {
        usuarioId: medica.id,
        username: medica.username,
        accion,
        entidad,
        entidadId,
        detalles: detalles,
      },
    });
  }

  it('muestra el curso de la atención médica y nunca las consultas', async () => {
    const { expediente, usuaria } = await crearExpediente(
      prisma,
      trabajoSocial.id,
      ['MEDICA'],
    );
    const atencion = await prisma.atencionMedica.create({
      data: {
        expedienteId: expediente.id,
        consecutivo: 1,
        referidoId: expediente.referidos[0].id,
        fechaInicio: new Date('2026-01-01'),
        creadoPorId: medica.id,
      },
    });
    const cita = await prisma.citaMedica.create({
      data: {
        atencionId: atencion.id,
        inicio: new Date('2026-01-05T16:00:00.000Z'),
        creadoPorId: medica.id,
      },
    });
    const enExpediente = { expedienteId: expediente.id };
    await auditar(
      'ATENCION_MEDICA_ABIERTA',
      'AtencionMedica',
      atencion.id,
      enExpediente,
    );
    await auditar('CITA_MEDICA_PROGRAMADA', 'CitaMedica', cita.id, {
      ...enExpediente,
      atencionId: atencion.id,
    });
    await auditar('CITA_MEDICA_NO_ASISTIO', 'CitaMedica', cita.id, {
      ...enExpediente,
      atencionId: atencion.id,
    });
    await auditar(
      'CONSULTA_MEDICA_REGISTRADA',
      'ConsultaMedica',
      atencion.id,
      enExpediente,
    );
    await auditar('ATENCION_MEDICA_ALTA', 'AtencionMedica', atencion.id, {
      ...enExpediente,
      motivo: 'ALTA_MEDICA',
    });

    const respuesta = await request(app.getHttpServer())
      .get(`/api/trabajo-social/usuarias/${usuaria.id}/bitacora`)
      .set('Cookie', sesionTs.cookie)
      .set('X-CSRF-Token', sesionTs.csrf)
      .expect(200);
    const eventos = respuesta.body as EventoBitacora[];
    const deMedica = eventos.filter((e) => e.accion.includes('MEDICA'));

    expect(deMedica.map((e) => e.texto).sort()).toEqual(
      [
        'Médica abrió la atención',
        'Médica cerró la atención (alta médica)',
        'Médica programó una cita',
      ].sort(),
    );
    for (const evento of deMedica) {
      expect(evento.expedienteNumero).toBe(expediente.numero);
    }
  });
});
