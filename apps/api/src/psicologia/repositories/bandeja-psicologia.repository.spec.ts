import type { PrismaService } from '../../prisma/prisma.service';
import { EXPEDIENTE_ID, PROCESO_ID, REFERIDO_ID } from '../pruebas/dobles';
import { BandejaPsicologiaRepository } from './bandeja-psicologia.repository';

// Prisma doble: lo que se prueba es qué condiciones viajan a la base, porque son ellas las que
// impiden quitarle un caso a una psicóloga activa. Datos ficticios.
function crearPrisma() {
  const tx = {
    atencionPsicologica: {
      findFirst: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    citaPsicologica: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    reasignacionAtencionPsicologica: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    $transaction: jest.fn((operacion: (cliente: typeof tx) => unknown) =>
      operacion(tx),
    ),
  };
  return { tx, prisma: prisma as unknown as PrismaService };
}

describe('BandejaPsicologiaRepository.reasignar', () => {
  const params = { procesoId: PROCESO_ID, psicologaId: 'psicologa-a' };
  const porReasignar = {
    expedienteId: EXPEDIENTE_ID,
    psicologaAsignadaId: 'psicologa-inactiva',
    fechaInicio: new Date('2026-05-04T15:00:00.000Z'),
    referidoId: REFERIDO_ID,
  };

  it('no toca nada si el proceso no existe, está cerrado o su psicóloga sigue activa', async () => {
    const { tx, prisma } = crearPrisma();
    tx.atencionPsicologica.findFirst.mockResolvedValue(null);

    await expect(
      new BandejaPsicologiaRepository(prisma).reasignar(params),
    ).resolves.toBeNull();
    expect(tx.atencionPsicologica.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: PROCESO_ID,
          estado: { not: 'CIERRE' },
          psicologaAsignada: { isActive: false },
        },
      }),
    );
    expect(tx.atencionPsicologica.updateMany).not.toHaveBeenCalled();
    expect(tx.citaPsicologica.updateMany).not.toHaveBeenCalled();
  });

  it('cambia de dueña solo si sigue siendo de la misma psicóloga desactivada', async () => {
    const { tx, prisma } = crearPrisma();
    tx.atencionPsicologica.findFirst.mockResolvedValue(porReasignar);

    await new BandejaPsicologiaRepository(prisma).reasignar(params);

    const [llamada] = tx.atencionPsicologica.updateMany.mock.calls as [
      [{ where: unknown; data: Record<string, unknown> }],
    ];
    expect(llamada[0].where).toEqual({
      id: PROCESO_ID,
      psicologaAsignadaId: 'psicologa-inactiva',
      estado: { not: 'CIERRE' },
      psicologaAsignada: { isActive: false },
    });
    expect(llamada[0].data).toMatchObject({
      psicologaAsignadaId: 'psicologa-a',
      actualizadoPorId: 'psicologa-a',
      version: { increment: 1 },
    });
  });

  it('si otra psicóloga ganó la carrera, no cancela citas ni devuelve nada', async () => {
    const { tx, prisma } = crearPrisma();
    tx.atencionPsicologica.findFirst.mockResolvedValue(porReasignar);
    tx.atencionPsicologica.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      new BandejaPsicologiaRepository(prisma).reasignar(params),
    ).resolves.toBeNull();
    expect(tx.citaPsicologica.updateMany).not.toHaveBeenCalled();
    expect(tx.reasignacionAtencionPsicologica.create).not.toHaveBeenCalled();
  });

  it('deja en el historial quién lo llevaba y quién lo tomó', async () => {
    const { tx, prisma } = crearPrisma();
    tx.atencionPsicologica.findFirst.mockResolvedValue(porReasignar);

    await new BandejaPsicologiaRepository(prisma).reasignar(params);

    expect(tx.reasignacionAtencionPsicologica.create).toHaveBeenCalledWith({
      data: {
        atencionId: PROCESO_ID,
        dePsicologaId: 'psicologa-inactiva',
        aPsicologaId: 'psicologa-a',
      },
    });
  });

  it('cancela todas las citas programadas: no se heredan', async () => {
    const { tx, prisma } = crearPrisma();
    tx.atencionPsicologica.findFirst.mockResolvedValue(porReasignar);
    tx.citaPsicologica.updateMany.mockResolvedValue({ count: 3 });

    await expect(
      new BandejaPsicologiaRepository(prisma).reasignar(params),
    ).resolves.toEqual({
      procesoId: PROCESO_ID,
      expedienteId: EXPEDIENTE_ID,
      psicologaAnteriorId: 'psicologa-inactiva',
      referidoIdPorAgendar: null,
      citasCanceladas: 3,
    });
    expect(tx.citaPsicologica.updateMany).toHaveBeenCalledWith({
      where: { atencionId: PROCESO_ID, estado: 'PROGRAMADA' },
      data: { estado: 'CANCELADA' },
    });
  });

  it('un caso sin primera cita queda por agendar para la nueva dueña', async () => {
    const { tx, prisma } = crearPrisma();
    tx.atencionPsicologica.findFirst.mockResolvedValue({
      ...porReasignar,
      fechaInicio: null,
    });

    await expect(
      new BandejaPsicologiaRepository(prisma).reasignar(params),
    ).resolves.toMatchObject({ referidoIdPorAgendar: REFERIDO_ID });
  });
});
