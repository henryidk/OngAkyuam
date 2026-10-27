import type { PrismaService } from '../../prisma/prisma.service';
import { PROCESO_LEGIBLE } from './acceso-expediente';
import { ConsultasProcesosRepository } from './consultas-procesos.repository';

function crearRepositorio() {
  const prisma = {
    atencionPsicologica: { findMany: jest.fn().mockResolvedValue([]) },
    citaPsicologica: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    prisma,
    repository: new ConsultasProcesosRepository(
      prisma as unknown as PrismaService,
    ),
  };
}

async function condicionesDe(alcance: 'MIOS' | 'EQUIPO') {
  const { prisma, repository } = crearRepositorio();
  await repository.listar({
    psicologaId: 'psicologa-a',
    alcance,
    filtro: 'ACTIVOS',
    palabras: [],
    limite: 20,
    ahora: new Date(),
  });
  const [[{ where }]] = prisma.atencionPsicologica.findMany.mock.calls as [
    [{ where: { AND: unknown[] } }],
  ];
  return where.AND;
}

describe('ConsultasProcesosRepository.listar', () => {
  it('"Míos" son solo los procesos de los que quien consulta es responsable', async () => {
    await expect(condicionesDe('MIOS')).resolves.toContainEqual({
      psicologaAsignadaId: 'psicologa-a',
    });
  });

  it('"Del equipo" son los procesos del área con responsable, nunca los de fuera', async () => {
    await expect(condicionesDe('EQUIPO')).resolves.toContainEqual({
      psicologaAsignadaId: { not: null },
      ...PROCESO_LEGIBLE,
    });
  });
});
