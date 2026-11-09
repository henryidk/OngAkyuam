import type { PrismaService } from '../../prisma/prisma.service';
import { PROCESO_LEGIBLE } from './acceso-expediente';
import { ConsultasProcesosRepository } from './consultas-procesos.repository';

function crearRepositorio() {
  const prisma = {
    atencionPsicologica: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
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
    pagina: 1,
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

  it('pide la página con OFFSET y cuenta el total con el mismo filtro', async () => {
    const { prisma, repository } = crearRepositorio();
    prisma.atencionPsicologica.count.mockResolvedValue(57);

    const resultado = await repository.listar({
      psicologaId: 'psicologa-a',
      alcance: 'MIOS',
      filtro: 'SIN_PROXIMA',
      palabras: ['ana'],
      pagina: 3,
      limite: 20,
      ahora: new Date(),
    });

    const [[consulta]] = prisma.atencionPsicologica.findMany.mock.calls as [
      [{ where: unknown; take: number; skip: number }],
    ];
    expect(consulta).toMatchObject({ take: 20, skip: 40 });
    // El total no puede contar procesos de otra psicóloga ni sin el filtro de la lista.
    expect(prisma.atencionPsicologica.count).toHaveBeenCalledWith({
      where: consulta.where,
    });
    expect(resultado.total).toBe(57);
  });
});

describe('ConsultasProcesosRepository.listar · sesión por registrar', () => {
  const ahora = new Date('2027-01-10T16:00:00Z');

  function fila(id: string) {
    return {
      id,
      consecutivo: 1,
      nino: null,
      estado: 'SEGUIMIENTO',
      fechaInicio: new Date('2026-12-01T15:00:00Z'),
      tomadaEn: null,
      createdAt: new Date('2026-11-30T15:00:00Z'),
      fechaCierre: null,
      expediente: {
        numero: '05-2026',
        usuaria: {
          id: `usuaria-${id}`,
          nombres: 'Prueba',
          apellidos: 'Ficticia',
          fechaNacimiento: new Date('1990-01-01T00:00:00Z'),
        },
      },
      citas: [],
      _count: { citas: 0 },
      psicologaAsignadaId: 'psicologa-a',
      psicologaAsignada: { nombreCompleto: 'Psicóloga A' },
    };
  }

  async function listarCon(citasPasadas: unknown[]) {
    const { prisma, repository } = crearRepositorio();
    prisma.atencionPsicologica.findMany.mockResolvedValue([
      fila('p-1'),
      fila('p-2'),
    ]);
    // La consulta de próximas pide `gte`; la de pendientes, `lt`.
    prisma.citaPsicologica.findMany.mockImplementation(
      ({ where }: { where: { fechaHora: { lt?: Date } } }) =>
        Promise.resolve(where.fechaHora.lt ? citasPasadas : []),
    );
    const pagina = await repository.listar({
      psicologaId: 'psicologa-a',
      alcance: 'MIOS',
      filtro: 'ACTIVOS',
      palabras: [],
      pagina: 1,
      limite: 20,
      ahora,
    });
    return { prisma, pagina };
  }

  it('marca el proceso con una cita que ya terminó sin registrarse', async () => {
    const { pagina } = await listarCon([
      {
        atencionId: 'p-1',
        fechaHora: new Date('2027-01-09T15:00:00Z'),
        duracionMinutos: 60,
        estado: 'PROGRAMADA',
      },
    ]);
    expect(
      pagina.items.map((item) => [item.id, item.sesionPorRegistrar]),
    ).toEqual([
      ['p-1', true],
      ['p-2', false],
    ]);
  });

  it('una cita que empezó pero sigue en curso no cuenta como por registrar', async () => {
    const { pagina } = await listarCon([
      {
        atencionId: 'p-1',
        fechaHora: new Date('2027-01-10T15:30:00Z'),
        duracionMinutos: 60,
        estado: 'PROGRAMADA',
      },
    ]);
    expect(pagina.items[0].sesionPorRegistrar).toBe(false);
  });

  it('solo pide citas programadas de los procesos de la página', async () => {
    const { prisma } = await listarCon([]);
    expect(prisma.citaPsicologica.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          atencionId: { in: ['p-1', 'p-2'] },
          estado: 'PROGRAMADA',
          fechaHora: { lt: ahora },
        },
      }),
    );
  });
});
