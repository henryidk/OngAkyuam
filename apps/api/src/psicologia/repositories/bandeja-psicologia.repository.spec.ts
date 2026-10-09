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

describe('BandejaPsicologiaRepository.obtenerPreviaToma', () => {
  // Lo que no debe verse antes de tomar el caso, en cualquier nivel de la respuesta.
  const CLAVES_PROHIBIDAS = [
    'agresor',
    'direccion',
    'telefono',
    'dpi',
    'ubicacionGeografica',
    'departamentoOtro',
    'observaciones',
  ];

  // Fila ficticia tal como la devolvería Prisma con el `select` de la vista previa.
  const fila = {
    id: REFERIDO_ID,
    motivo: 'Motivo ficticio',
    createdAt: new Date('2026-10-01T15:00:00.000Z'),
    puedeVerDatosCaso: true,
    otorgadoPor: { nombreCompleto: 'Trabajadora Social Ficticia' },
    expediente: {
      numero: '05-2026',
      tipologiaDelito: ['FISICA'],
      usuaria: {
        nombres: 'Usuaria',
        apellidos: 'Ficticia',
        fechaNacimiento: new Date('1990-01-15T00:00:00.000Z'),
        municipio: 'COBAN',
        municipioOtro: null,
        grupoEtnico: 'MAYA_QECHI',
      },
      ninos: [
        {
          id: 'nino-1',
          nombres: 'Hija',
          apellidos: 'Ficticia',
          fechaNacimiento: new Date('2018-03-02T00:00:00.000Z'),
        },
      ],
    },
  };

  function crearRepositorio(resultado: unknown) {
    const findFirst = jest.fn().mockResolvedValue(resultado);
    const prisma = { referidoArea: { findFirst } } as unknown as PrismaService;
    return { findFirst, repositorio: new BandejaPsicologiaRepository(prisma) };
  }

  function clavesDe(valor: unknown): string[] {
    if (Array.isArray(valor)) {
      return valor.flatMap(clavesDe);
    }
    if (valor && typeof valor === 'object') {
      return Object.entries(valor).flatMap(([clave, hijo]) => [
        clave,
        ...clavesDe(hijo),
      ]);
    }
    return [];
  }

  it('no pide a la base agresor, dirección, teléfono, DPI ni ubicación', async () => {
    const { findFirst, repositorio } = crearRepositorio(fila);

    await repositorio.obtenerPreviaToma(REFERIDO_ID);

    const [consulta] = findFirst.mock.calls[0] as [
      { where: unknown; select: unknown; include?: unknown },
    ];
    expect(consulta.where).toEqual({ id: REFERIDO_ID, area: 'PSICOLOGIA' });
    expect(consulta.include).toBeUndefined();
    const pedidas = clavesDe(consulta.select);
    for (const clave of CLAVES_PROHIBIDAS) {
      expect(pedidas).not.toContain(clave);
    }
  });

  it('el JSON de respuesta no contiene esas claves', async () => {
    const { repositorio } = crearRepositorio(fila);

    const previa = await repositorio.obtenerPreviaToma(REFERIDO_ID);

    const devueltas = clavesDe(JSON.parse(JSON.stringify(previa)));
    for (const clave of CLAVES_PROHIBIDAS) {
      expect(devueltas).not.toContain(clave);
    }
    expect(previa).toMatchObject({
      usuariaNombreCompleto: 'Usuaria Ficticia',
      municipio: 'Cobán',
      grupoEtnico: "Maya Q'eqchi'",
      tipologias: ['Física'],
      motivo: 'Motivo ficticio',
    });
    expect(previa?.personas).toHaveLength(2);
  });

  it('oculta la tipología si Trabajo Social no compartió los datos del caso', async () => {
    const { repositorio } = crearRepositorio({
      ...fila,
      puedeVerDatosCaso: false,
    });

    const previa = await repositorio.obtenerPreviaToma(REFERIDO_ID);

    expect(previa?.tipologias).toBeNull();
  });

  it('devuelve null si la referencia no existe o no es de Psicología', async () => {
    const { repositorio } = crearRepositorio(null);

    await expect(
      repositorio.obtenerPreviaToma(REFERIDO_ID),
    ).resolves.toBeNull();
  });
});
