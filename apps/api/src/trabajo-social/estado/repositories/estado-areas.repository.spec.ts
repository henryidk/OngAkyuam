import type { PrismaService } from '../../../prisma/prisma.service';
import { EstadoAreasRepository } from './estado-areas.repository';

// Filas con la forma del `select` de `atencionPsicologica`, de la más reciente a la más antigua.
function proceso(
  estado: string,
  psicologa: string | null,
  proximas: string[] = [],
) {
  return {
    estado,
    psicologaAsignada: psicologa ? { nombreCompleto: psicologa } : null,
    citas: proximas.map((fecha) => ({ fechaHora: new Date(fecha) })),
  };
}

function repositorioCon(filas: ReturnType<typeof proceso>[]) {
  const prisma = {
    atencionPsicologica: { findMany: jest.fn().mockResolvedValue(filas) },
  } as unknown as PrismaService;
  return new EstadoAreasRepository(prisma);
}

describe('EstadoAreasRepository.atencionPsicologica', () => {
  it('sin procesos no hay atención (el caso sigue en cola)', async () => {
    await expect(
      repositorioCon([]).atencionPsicologica('exp-1'),
    ).resolves.toBeNull();
  });

  it('sigue en atención si el proceso de un hijo/a está abierto aunque el de la usuaria se cerró', async () => {
    const atencion = await repositorioCon([
      proceso('CIERRE', 'Psicóloga A'),
      proceso('SEGUIMIENTO', 'Psicóloga B', ['2026-11-03T15:00:00.000Z']),
    ]).atencionPsicologica('exp-1');

    expect(atencion).toEqual({
      estado: 'SEGUIMIENTO',
      psicologa: 'Psicóloga B',
      proximaCita: new Date('2026-11-03T15:00:00.000Z'),
    });
  });

  it('la próxima cita es la más cercana entre todas las personas con proceso abierto', async () => {
    const atencion = await repositorioCon([
      proceso('SEGUIMIENTO', 'Psicóloga A', ['2026-11-10T15:00:00.000Z']),
      proceso('INICIO', 'Psicóloga B', ['2026-11-04T15:00:00.000Z']),
    ]).atencionPsicologica('exp-1');

    expect(atencion?.proximaCita).toEqual(new Date('2026-11-04T15:00:00.000Z'));
  });

  it('con todo cerrado, informa el cierre del más reciente', async () => {
    const atencion = await repositorioCon([
      proceso('CIERRE', 'Psicóloga B'),
      proceso('CIERRE', 'Psicóloga A'),
    ]).atencionPsicologica('exp-1');

    expect(atencion).toEqual({
      estado: 'CIERRE',
      psicologa: 'Psicóloga B',
      proximaCita: null,
    });
  });
});
