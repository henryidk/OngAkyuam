import type { PrismaService } from '../../prisma/prisma.service';
import { PROCESO_LEGIBLE } from './acceso-expediente';
import {
  condicionHistorial,
  ConsultasSesionesRepository,
} from './consultas-sesiones.repository';

const AHORA = new Date('2026-10-27T18:00:00.000Z');
const RANGO = {
  desde: new Date('2026-10-01T06:00:00.000Z'),
  hasta: new Date('2026-11-01T06:00:00.000Z'),
};

function crearRepositorio() {
  const prisma = {
    citaPsicologica: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  return {
    prisma,
    repository: new ConsultasSesionesRepository(
      prisma as unknown as PrismaService,
    ),
  };
}

describe('ConsultasSesionesRepository', () => {
  describe('porRegistrar', () => {
    it('solo trae sesiones que quien consulta atendió, ya empezadas y en procesos abiertos del área', async () => {
      const { prisma, repository } = crearRepositorio();

      await repository.porRegistrar('psicologa-a', AHORA);

      expect(prisma.citaPsicologica.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            atendidoPorId: 'psicologa-a',
            atencion: { estado: { not: 'CIERRE' }, ...PROCESO_LEGIBLE },
            estado: 'PROGRAMADA',
            fechaHora: { lte: AHORA },
          },
        }),
      );
    });
  });

  describe('condicionHistorial', () => {
    const base = {
      psicologaId: 'psicologa-a',
      ...RANGO,
      palabras: [],
    };

    it('"Mías" exige haber atendido la sesión', () => {
      const { AND } = condicionHistorial({ ...base, alcance: 'MIOS' }) as {
        AND: unknown[];
      };

      expect(AND).toContainEqual({ atendidoPorId: 'psicologa-a' });
      expect(AND).toContainEqual({ atencion: PROCESO_LEGIBLE });
    });

    it('"Del equipo" no filtra por quién atendió, pero nunca sale del área', () => {
      const condicion = condicionHistorial({ ...base, alcance: 'EQUIPO' });

      expect(JSON.stringify(condicion)).not.toContain('atendidoPorId');
      expect((condicion as { AND: unknown[] }).AND).toContainEqual({
        atencion: PROCESO_LEGIBLE,
      });
    });

    it('solo sesiones realizadas, dentro del rango y con los filtros elegidos', () => {
      const { AND } = condicionHistorial({
        ...base,
        alcance: 'EQUIPO',
        clinica: 'CLINICA_1',
        estado: 'NO_ASISTIO',
        palabras: ['ana'],
      }) as { AND: unknown[] };

      expect(AND).toContainEqual({
        estado: { in: ['ATENDIDA', 'NO_ASISTIO'] },
      });
      expect(AND).toContainEqual({
        fechaHora: { gte: RANGO.desde, lt: RANGO.hasta },
      });
      expect(AND).toContainEqual({ clinica: 'CLINICA_1' });
      expect(AND).toContainEqual({ estado: 'NO_ASISTIO' });
      // La palabra se busca también en el nombre del hijo/a.
      expect(JSON.stringify(AND)).toContain('"nino"');
    });
  });

  describe('detalle', () => {
    it('solo abre sesiones ya registradas de un expediente del área', async () => {
      const { prisma, repository } = crearRepositorio();

      await expect(repository.detalle('cita-1')).resolves.toBeNull();

      expect(prisma.citaPsicologica.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'cita-1',
            atencion: PROCESO_LEGIBLE,
            estado: { in: ['ATENDIDA', 'NO_ASISTIO'] },
          },
        }),
      );
    });
  });
});
