import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { AgendaMedicaRepository } from '../repositories/agenda-medica.repository';

const CORTE = {
  fecha: '2026-11-10',
  instante: new Date('2026-11-11T06:00:00Z'),
};

function repositorio(filas: unknown[]) {
  const queryRaw = jest.fn().mockResolvedValue(filas);
  const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
  return { repo: new AgendaMedicaRepository(prisma), queryRaw };
}

function sqlDe(queryRaw: jest.Mock, llamada = 0): Prisma.Sql {
  return (queryRaw.mock.calls[llamada] as [Prisma.Sql])[0];
}

// Es una lista de sobrevivientes: solo puede traer atenciones activas de expedientes referidos a
// Medicina, y el texto buscado nunca se pega en el SQL.
describe('AgendaMedicaRepository · sin próxima consulta', () => {
  it('solo atenciones activas, de expedientes referidos a Medicina, sin cita programada', async () => {
    const { repo, queryRaw } = repositorio([]);
    await repo.paginaSinProxima({ corte: CORTE }, 1, 20);
    const { sql } = sqlDe(queryRaw);
    expect(sql).toContain(`a.estado = 'ACTIVA'`);
    expect(sql).toContain(`rx.area = 'MEDICA'`);
    expect(sql).toMatch(
      /NOT EXISTS \(\s*SELECT 1 FROM "CitaMedica" cp[\s\S]*cp\.estado = 'PROGRAMADA'/,
    );
  });

  it('el nombre buscado viaja como parámetro, nunca dentro del texto SQL', async () => {
    const { repo, queryRaw } = repositorio([]);
    await repo.paginaSinProxima(
      { corte: CORTE, busqueda: { tipo: 'nombre', valor: 'Ana Pérez' } },
      1,
      20,
    );
    const consulta = sqlDe(queryRaw);
    expect(consulta.sql).not.toContain('Ana Pérez');
    expect(consulta.values).toContain('Ana Pérez');
  });

  it('pagina con OFFSET de páginas completas y filtra el grupo pedido', async () => {
    const { repo, queryRaw } = repositorio([]);
    await repo.paginaSinProxima({ corte: CORTE, grupo: 'SIN_VENIR' }, 3, 20);
    const consulta = sqlDe(queryRaw);
    expect(consulta.sql).toMatch(/LIMIT \? OFFSET \?/);
    expect(consulta.values).toEqual(
      expect.arrayContaining([
        20,
        40,
        'SIN_VENIR',
        CORTE.instante,
        CORTE.fecha,
      ]),
    );
  });

  it('arma la fila: código de atención, quién atendió y la fecha en Guatemala del último hecho', async () => {
    const { repo } = repositorio([
      {
        atencionId: 'at-1',
        version: 3,
        consecutivo: 2,
        fechaInicio: new Date('2026-06-01T00:00:00Z'),
        expedienteId: 'ex-1',
        expedienteNumero: '05-2026',
        usuariaId: 'us-1',
        nombres: 'Ana',
        apellidos: 'Pérez',
        atendioPor: 'Dra. Ruiz',
        motivo: 'NO_ASISTIO',
        grupo: 'NO_ASISTIO',
        // 3 de enero a las 21:00 en Guatemala: en UTC ya es día 4.
        momento: new Date('2027-01-04T03:00:00Z'),
      },
      {
        atencionId: 'at-2',
        version: 1,
        consecutivo: 1,
        fechaInicio: new Date('2026-12-20T00:00:00Z'),
        expedienteId: 'ex-2',
        expedienteNumero: '06-2026',
        usuariaId: 'us-2',
        nombres: 'Luisa',
        apellidos: 'Gómez',
        atendioPor: null,
        motivo: 'SIN_FECHA',
        grupo: 'SIN_FECHA',
        momento: null,
      },
    ]);
    const [conFalta, sinNada] = await repo.paginaSinProxima(
      { corte: CORTE },
      1,
      20,
    );
    expect(conFalta).toMatchObject({
      atencionVersion: 3,
      usuariaNombreCompleto: 'Ana Pérez',
      atendioPor: 'Dra. Ruiz',
      desde: '2027-01-03',
      grupo: 'NO_ASISTIO',
    });
    expect(conFalta.codigoAtencion).toContain('05-2026');
    // Sin consulta ni falta: cuenta el inicio de la atención (fecha sin hora).
    expect(sinNada).toMatchObject({ desde: '2026-12-20', atendioPor: null });
  });

  it('los conteos salen de la misma consulta, sin filtrar por grupo', async () => {
    const conteos = { TODAS: 3, NO_ASISTIO: 1, SIN_FECHA: 1, SIN_VENIR: 1 };
    const { repo, queryRaw } = repositorio([conteos]);
    await expect(repo.conteosSinProxima({ corte: CORTE })).resolves.toEqual(
      conteos,
    );
    const { sql } = sqlDe(queryRaw);
    expect(sql).toContain('FROM sin_proxima');
    expect(sql).toContain(`rx.area = 'MEDICA'`);
    expect(sql).not.toMatch(/^\s*WHERE grupo =/m);
  });
});
