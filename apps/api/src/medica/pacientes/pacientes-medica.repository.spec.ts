import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { PacientesMedicaRepository } from '../repositories/pacientes-medica.repository';

const AHORA = new Date('2026-11-08T18:00:00Z');
const CONTEOS = { TODAS: 75, EN_ATENCION: 40, POR_AGENDAR: 5, DE_ALTA: 30 };

function repositorio() {
  const queryRaw = jest
    .fn()
    // La primera consulta trae la página; la segunda, los conteos.
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([CONTEOS]);
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  return { repo: new PacientesMedicaRepository(prisma), queryRaw };
}

function sqlDe(queryRaw: jest.Mock, llamada = 0): Prisma.Sql {
  return (queryRaw.mock.calls[llamada] as [Prisma.Sql])[0];
}

describe('PacientesMedicaRepository · listar por páginas', () => {
  it('pide la página con OFFSET de páginas completas, en orden por nombre', async () => {
    const { repo, queryRaw } = repositorio();
    await repo.listar({
      busqueda: undefined,
      estado: 'EN_ATENCION',
      pagina: 3,
      porPagina: 30,
      ahora: AHORA,
    });
    const consulta = sqlDe(queryRaw);
    expect(consulta.sql).toMatch(
      /ORDER BY "nombreOrden", "usuariaId"\s*LIMIT \?\s*OFFSET \?/,
    );
    expect(consulta.values).toEqual(
      expect.arrayContaining(['EN_ATENCION', 30, 60]),
    );
  });

  it('el total es el de la situación pedida, el mismo número que su chip', async () => {
    const { repo } = repositorio();
    const pagina = await repo.listar({
      busqueda: undefined,
      estado: 'DE_ALTA',
      pagina: 2,
      porPagina: 30,
      ahora: AHORA,
    });
    expect(pagina).toMatchObject({
      total: 30,
      pagina: 2,
      porPagina: 30,
      conteos: CONTEOS,
    });
  });

  it('sin situación, el total es el de todas', async () => {
    const { repo } = repositorio();
    const pagina = await repo.listar({
      busqueda: undefined,
      estado: undefined,
      pagina: 1,
      porPagina: 30,
      ahora: AHORA,
    });
    expect(pagina.total).toBe(75);
  });

  it('el nombre buscado viaja como parámetro, nunca dentro del texto SQL', async () => {
    const { repo, queryRaw } = repositorio();
    await repo.listar({
      busqueda: { tipo: 'nombre', valor: 'Ana Pérez' },
      estado: undefined,
      pagina: 1,
      porPagina: 30,
      ahora: AHORA,
    });
    const consulta = sqlDe(queryRaw);
    expect(consulta.sql).not.toContain('Ana Pérez');
    expect(consulta.values).toContain('Ana Pérez');
  });
});
