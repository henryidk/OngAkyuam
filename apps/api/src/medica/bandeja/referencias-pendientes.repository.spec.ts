import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { AgendaMedicaRepository } from '../repositories/agenda-medica.repository';

function repositorio(ids: string[] = []) {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue(ids.map((id) => ({ id }))),
    referidoArea: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    prisma,
    repo: new AgendaMedicaRepository(prisma as unknown as PrismaService),
  };
}

function sqlDe(queryRaw: jest.Mock): Prisma.Sql {
  return (queryRaw.mock.calls[0] as [Prisma.Sql])[0];
}

describe('AgendaMedicaRepository · referencias pendientes (Área de atención)', () => {
  it('pide al servidor solo las más antiguas hasta el tope, con la regla completa en SQL', async () => {
    const { prisma, repo } = repositorio(['r1', 'r2']);
    await repo.referenciasPendientes(200);

    const consulta = sqlDe(prisma.$queryRaw);
    expect(consulta.sql).toMatch(/r\.area = 'MEDICA'/);
    // Pendiente = sin atención activa ni abierta después de la referencia.
    expect(consulta.sql).toMatch(
      /a\.estado = 'ACTIVA' OR a\."createdAt" >= r\."createdAt"/,
    );
    expect(consulta.sql).toMatch(
      /ORDER BY r\."createdAt" ASC, r\.id ASC\s*LIMIT \?/,
    );
    expect(consulta.values).toEqual([200]);
    expect(prisma.referidoArea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['r1', 'r2'] } } }),
    );
  });

  it('sin referencias pendientes no hace la segunda consulta', async () => {
    const { prisma, repo } = repositorio([]);
    await expect(repo.referenciasPendientes(200)).resolves.toEqual([]);
    expect(prisma.referidoArea.findMany).not.toHaveBeenCalled();
  });

  it('el conteo del menú usa la misma regla y no trae filas', async () => {
    const { prisma, repo } = repositorio();
    prisma.$queryRaw.mockResolvedValue([{ total: BigInt(312) }]);

    await expect(repo.contarReferenciasPendientes()).resolves.toBe(312);
    const consulta = sqlDe(prisma.$queryRaw);
    expect(consulta.sql).toMatch(/SELECT COUNT\(\*\) AS total/);
    expect(consulta.sql).toMatch(/a\."createdAt" >= r\."createdAt"/);
  });
});
