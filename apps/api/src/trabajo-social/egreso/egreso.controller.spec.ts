import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Rol } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { EgresoController } from './egreso.controller';
import { EgresoService } from './egreso.service';

const EXPEDIENTE_ID = '3f0c1d52-8a6b-4c1e-9d2f-7b5a4e6c8d90';
const RUTA = `/trabajo-social/expedientes/${EXPEDIENTE_ID}/egreso`;

/** Petición HTTP real contra el controller (guard de roles, pipes y ruta), con el service simulado. */
describe('POST /trabajo-social/expedientes/:id/egreso', () => {
  let app: INestApplication<App>;
  let rolAutenticado: Rol;
  const egresoService = { registrar: jest.fn() };

  beforeEach(async () => {
    egresoService.registrar.mockReset();
    egresoService.registrar.mockResolvedValue({
      expedienteId: EXPEDIENTE_ID,
      fechaEgreso: '2026-02-01',
    });
    rolAutenticado = 'TRABAJO_SOCIAL';

    const modulo = await Test.createTestingModule({
      controllers: [EgresoController],
      providers: [{ provide: EgresoService, useValue: egresoService }],
    }).compile();

    app = modulo.createNestApplication();
    // Sustituye al guard JWT global: deja en la request el usuario ya autenticado.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, {
        user: { id: 'ts-1', username: 'trabajo_social', rol: rolAutenticado },
      });
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registra el egreso para Trabajo Social', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(RUTA)
      .send({ fechaEgreso: '2026-02-01' })
      .expect(201);

    expect(respuesta.body).toEqual({
      expedienteId: EXPEDIENTE_ID,
      fechaEgreso: '2026-02-01',
    });
    expect(egresoService.registrar).toHaveBeenCalledWith(
      EXPEDIENTE_ID,
      { fechaEgreso: '2026-02-01' },
      expect.objectContaining({ usuarioId: 'ts-1' }),
    );
  });

  it.each<Rol>(['JURIDICO', 'PSICOLOGIA', 'MEDICA', 'ADMINISTRACION'])(
    'responde 403 al rol %s',
    async (rol) => {
      rolAutenticado = rol;

      await request(app.getHttpServer())
        .post(RUTA)
        .send({ fechaEgreso: '2026-02-01' })
        .expect(403);
      expect(egresoService.registrar).not.toHaveBeenCalled();
    },
  );

  it('responde 400 si el id no es un UUID', async () => {
    await request(app.getHttpServer())
      .post('/trabajo-social/expedientes/no-es-uuid/egreso')
      .send({ fechaEgreso: '2026-02-01' })
      .expect(400);
    expect(egresoService.registrar).not.toHaveBeenCalled();
  });

  it.each([
    ['sin fecha', {}],
    ['con formato inválido', { fechaEgreso: '01/02/2026' }],
    ['con fecha futura', { fechaEgreso: '2999-01-01' }],
  ])('responde 400 %s', async (_caso, cuerpo) => {
    await request(app.getHttpServer()).post(RUTA).send(cuerpo).expect(400);
    expect(egresoService.registrar).not.toHaveBeenCalled();
  });
});
