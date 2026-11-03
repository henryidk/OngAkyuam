import type { INestApplication } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  ATENCION_PSICOLOGICA_REPOSITORY,
  type IAtencionPsicologicaRepository,
} from '../../src/psicologia/interfaces/atencion-psicologica-repository.interface';
import { crearApp, crearExpediente, crearUsuario } from './fixtures';

/**
 * "Tomar caso" en Psicología corre en una transacción Serializable con `FOR UPDATE` sobre el
 * expediente y reintentos, igual que Jurídico y Médica. Dos psicólogas que toman la misma
 * referencia a la vez: una sola se queda con el caso y nace un solo proceso. Es de privacidad:
 * si las dos ganaran, la segunda vería un caso que no le corresponde.
 */
describe('Tomar caso de Psicología en paralelo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let repositorio: IAtencionPsicologicaRepository;
  let ts: Usuario;
  let psicologas: Usuario[];

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    repositorio = app.get(ATENCION_PSICOLOGICA_REPOSITORY);
    ts = await crearUsuario(prisma, 'TRABAJO_SOCIAL');
    psicologas = await Promise.all(
      [1, 2, 3, 4].map(() => crearUsuario(prisma, 'PSICOLOGIA')),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('de cuatro tomas simultáneas solo una gana y queda un solo proceso, el 1', async () => {
    const { expediente } = await crearExpediente(prisma, ts.id, ['PSICOLOGIA']);

    const resultados = await Promise.all(
      psicologas.map((psicologa) =>
        repositorio.tomarCaso({
          expedienteId: expediente.id,
          psicologaId: psicologa.id,
        }),
      ),
    );

    expect(resultados.filter((r) => r === 'TOMADO')).toHaveLength(1);
    expect(resultados.filter((r) => r === 'YA_TOMADO')).toHaveLength(3);

    const procesos = await prisma.atencionPsicologica.findMany({
      where: { expedienteId: expediente.id },
      select: { consecutivo: true, psicologaAsignadaId: true },
    });
    const ganadora = psicologas[resultados.indexOf('TOMADO')];
    expect(procesos).toEqual([
      { consecutivo: 1, psicologaAsignadaId: ganadora.id },
    ]);
  });

  it('tomar un caso ya tomado no crea otro proceso ni cambia de dueña', async () => {
    const { expediente } = await crearExpediente(prisma, ts.id, ['PSICOLOGIA']);
    const [primera, segunda] = psicologas;

    await expect(
      repositorio.tomarCaso({
        expedienteId: expediente.id,
        psicologaId: primera.id,
      }),
    ).resolves.toBe('TOMADO');
    await expect(
      repositorio.tomarCaso({
        expedienteId: expediente.id,
        psicologaId: segunda.id,
      }),
    ).resolves.toBe('YA_TOMADO');

    const procesos = await prisma.atencionPsicologica.findMany({
      where: { expedienteId: expediente.id },
      select: { psicologaAsignadaId: true },
    });
    expect(procesos).toEqual([{ psicologaAsignadaId: primera.id }]);
  });

  it('sin referencia a Psicología no se toma', async () => {
    const { expediente } = await crearExpediente(prisma, ts.id, ['JURIDICO']);

    await expect(
      repositorio.tomarCaso({
        expedienteId: expediente.id,
        psicologaId: psicologas[0].id,
      }),
    ).resolves.toBe('YA_TOMADO');
    await expect(
      prisma.atencionPsicologica.count({
        where: { expedienteId: expediente.id },
      }),
    ).resolves.toBe(0);
  });
});
