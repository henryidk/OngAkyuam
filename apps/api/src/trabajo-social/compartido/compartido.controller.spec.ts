import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Rol } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { CompartidoController } from './compartido.controller';
import { CompartidoService } from './compartido.service';

const EXPEDIENTE_ID = '3f0c1d52-8a6b-4c1e-9d2f-7b5a4e6c8d90';
const RUTA = `/trabajo-social/expedientes/${EXPEDIENTE_ID}/compartido`;

/** Petición HTTP real contra el controller (guard de roles, pipes y ruta), con el service simulado. */
describe('GET /trabajo-social/expedientes/:id/compartido', () => {
  let app: INestApplication<App>;
  let rolAutenticado: Rol;
  const compartidoService = { obtener: jest.fn() };

  beforeEach(async () => {
    compartidoService.obtener.mockReset();
    compartidoService.obtener.mockResolvedValue([]);
    rolAutenticado = 'TRABAJO_SOCIAL';

    const modulo = await Test.createTestingModule({
      controllers: [CompartidoController],
      providers: [{ provide: CompartidoService, useValue: compartidoService }],
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

  it('responde a Trabajo Social', async () => {
    await request(app.getHttpServer()).get(RUTA).expect(200);

    expect(compartidoService.obtener).toHaveBeenCalledWith(
      EXPEDIENTE_ID,
      expect.objectContaining({ usuarioId: 'ts-1' }),
    );
  });

  it.each<Rol>(['JURIDICO', 'PSICOLOGIA', 'MEDICA', 'ADMINISTRACION'])(
    'responde 403 al rol %s',
    async (rol) => {
      rolAutenticado = rol;

      await request(app.getHttpServer()).get(RUTA).expect(403);
      expect(compartidoService.obtener).not.toHaveBeenCalled();
    },
  );

  it('responde 400 si el id no es un UUID', async () => {
    await request(app.getHttpServer())
      .get('/trabajo-social/expedientes/no-es-uuid/compartido')
      .expect(400);
    expect(compartidoService.obtener).not.toHaveBeenCalled();
  });
});
