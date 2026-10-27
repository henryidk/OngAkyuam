import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { RegistrarConsultaParams } from '../interfaces/citas-psicologicas-repository.interface';
import { CitasPsicologicasRepository } from './citas-psicologicas.repository';

const CITA = {
  id: 'cita-1',
  fechaHora: new Date('2026-10-01T15:00:00.000Z'),
  modalidad: 'PRESENCIAL',
  lugar: null,
  motivo: '',
  tipo: 'SEGUIMIENTO',
  duracionMinutos: 45,
  estado: 'ATENDIDA',
  observaciones: null,
  acuerdos: null,
  motivoNoAsistencia: null,
  temas: null,
  intervencion: null,
  recomendaciones: null,
  clinica: 'CLINICA_1',
  enfoqueTerapeutico: null,
  borrador: false,
  reprogramadaDesdeId: null,
  atendidoPor: { nombreCompleto: 'Psicóloga A' },
  documentos: [],
};

function crearTx() {
  return {
    // Bloqueo `FOR UPDATE` del proceso abierto: devuelve la fila si cumple las condiciones.
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'proceso-1' }]),
    citaPsicologica: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ atencionId: 'proceso-1', ninoId: 'nino-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'cita-2' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(CITA),
    },
    atencionPsicologica: {
      // Paso de Inicio a Seguimiento.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    cambioEstadoAtencion: { create: jest.fn() },
  };
}

function params(
  cambios: Partial<RegistrarConsultaParams> = {},
): RegistrarConsultaParams {
  return {
    citaId: 'cita-1',
    psicologaId: 'psicologa-a',
    estado: 'ATENDIDA',
    temas: null,
    intervencion: null,
    recomendaciones: null,
    acuerdos: null,
    observaciones: null,
    motivoNoAsistencia: null,
    clinica: 'CLINICA_1',
    enfoqueTerapeutico: null,
    borrador: false,
    proximaCita: null,
    ...cambios,
  };
}

/** El SQL del bloqueo del proceso, ya con sus fragmentos anidados resueltos. */
function sqlDelBloqueo(tx: ReturnType<typeof crearTx>): Prisma.Sql {
  const [partes, ...valores] = tx.$queryRaw.mock.calls[0] as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return Prisma.sql(partes, ...valores);
}

describe('CitasPsicologicasRepository.registrarConsulta', () => {
  let tx: ReturnType<typeof crearTx>;
  let repository: CitasPsicologicasRepository;

  beforeEach(() => {
    tx = crearTx();
    const prisma = {
      $transaction: jest.fn((trabajo: (cliente: typeof tx) => unknown) =>
        trabajo(tx),
      ),
    } as unknown as PrismaService;
    repository = new CitasPsicologicasRepository(prisma);
  });

  it('no escribe nada si el proceso ya se cerró', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(repository.registrarConsulta(params())).resolves.toBeNull();

    const bloqueo = sqlDelBloqueo(tx);
    expect(bloqueo.sql).toContain(`estado <> 'CIERRE'`);
    expect(bloqueo.sql).toContain('FOR UPDATE');
    expect(bloqueo.values).toEqual(['proceso-1']);
    expect(tx.citaPsicologica.updateMany).not.toHaveBeenCalled();
    expect(tx.citaPsicologica.create).not.toHaveBeenCalled();
  });

  it('registrar no exige ser la responsable: solo haber atendido la cita', async () => {
    await repository.registrarConsulta(params());

    expect(sqlDelBloqueo(tx).sql).not.toContain('psicologaAsignadaId');
    expect(tx.citaPsicologica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'cita-1',
          atendidoPorId: 'psicologa-a',
        }) as unknown,
      }),
    );
  });

  it('programar la próxima cita exige además ser la responsable del proceso', async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      repository.registrarConsulta(
        params({
          proximaCita: { fechaHora: new Date(), duracionMinutos: 45 },
        }),
      ),
    ).resolves.toBeNull();

    const bloqueo = sqlDelBloqueo(tx);
    expect(bloqueo.sql).toContain('"psicologaAsignadaId" = ?');
    expect(bloqueo.values).toEqual(['proceso-1', 'psicologa-a']);
    expect(tx.citaPsicologica.updateMany).not.toHaveBeenCalled();
    expect(tx.citaPsicologica.create).not.toHaveBeenCalled();
  });

  it('no registra una cita que ya se movió a otra fecha', async () => {
    tx.citaPsicologica.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.registrarConsulta(
        params({
          proximaCita: { fechaHora: new Date(), duracionMinutos: 45 },
        }),
      ),
    ).resolves.toBeNull();

    expect(tx.citaPsicologica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'cita-1',
          atendidoPorId: 'psicologa-a',
          estado: { not: 'REPROGRAMADA' },
        },
      }),
    );
    expect(tx.cambioEstadoAtencion.create).not.toHaveBeenCalled();
    expect(tx.citaPsicologica.create).not.toHaveBeenCalled();
  });

  it('guarda la clínica y el enfoque junto con el registro', async () => {
    await repository.registrarConsulta(
      params({ enfoqueTerapeutico: 'Sistémico' }),
    );

    expect(tx.citaPsicologica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinica: 'CLINICA_1',
          enfoqueTerapeutico: 'Sistémico',
        }) as unknown,
      }),
    );
  });

  it('la primera sesión atendida pasa el proceso a Seguimiento y deja el hito', async () => {
    const resultado = await repository.registrarConsulta(params());

    expect(resultado?.pasoASeguimiento).toBe(true);
    expect(tx.atencionPsicologica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'proceso-1', estado: 'INICIO' },
        data: expect.objectContaining({ estado: 'SEGUIMIENTO' }) as unknown,
      }),
    );
    expect(tx.cambioEstadoAtencion.create).toHaveBeenCalledWith({
      data: {
        atencionId: 'proceso-1',
        estadoAnterior: 'INICIO',
        estadoNuevo: 'SEGUIMIENTO',
        registradoPorId: 'psicologa-a',
      },
    });
  });

  it('una sesión atendida en un proceso que ya está en Seguimiento no deja otro hito', async () => {
    tx.atencionPsicologica.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await repository.registrarConsulta(params());

    expect(resultado?.pasoASeguimiento).toBe(false);
    expect(tx.cambioEstadoAtencion.create).not.toHaveBeenCalled();
  });

  it.each(['NO_ASISTIO', 'CANCELADA', undefined] as const)(
    'con resultado %s la etapa no cambia',
    async (estado) => {
      const resultado = await repository.registrarConsulta(
        params({ estado, borrador: estado === undefined }),
      );

      expect(resultado?.pasoASeguimiento).toBe(false);
      expect(tx.atencionPsicologica.updateMany).not.toHaveBeenCalled();
      expect(tx.cambioEstadoAtencion.create).not.toHaveBeenCalled();
    },
  );

  it('la próxima cita nace en el mismo proceso y para la misma persona', async () => {
    const fechaHora = new Date('2026-10-15T15:00:00.000Z');

    const resultado = await repository.registrarConsulta(
      params({ proximaCita: { fechaHora, duracionMinutos: 60 } }),
    );

    expect(resultado?.proximaCitaId).toBe('cita-2');
    expect(tx.citaPsicologica.create).toHaveBeenCalledWith({
      data: {
        atencionId: 'proceso-1',
        fechaHora,
        duracionMinutos: 60,
        tipo: 'SEGUIMIENTO',
        ninoId: 'nino-1',
        atendidoPorId: 'psicologa-a',
      },
      select: { id: true },
    });
  });
});

describe('CitasPsicologicasRepository.listarCitasEnRango', () => {
  // Fila ficticia con la forma del `select` de los reportes.
  function filaCita(puedeVerDatosCaso: boolean | null) {
    return {
      fechaHora: new Date('2026-10-01T15:00:00.000Z'),
      estado: 'ATENDIDA',
      tipo: 'SEGUIMIENTO',
      ninoId: null,
      nino: null,
      atencion: {
        consecutivo: 1,
        expediente: {
          numero: '05-2026',
          usuariaId: 'usuaria-1',
          tipologiaDelito: ['FISICA'],
          referidos: puedeVerDatosCaso === null ? [] : [{ puedeVerDatosCaso }],
          usuaria: {
            fechaNacimiento: new Date('1990-01-15T00:00:00.000Z'),
            grupoEtnico: 'LADINO',
            municipio: 'COBAN',
          },
        },
      },
    };
  }

  async function tipologiasCon(puedeVerDatosCaso: boolean | null) {
    const prisma = {
      citaPsicologica: {
        findMany: jest.fn().mockResolvedValue([filaCita(puedeVerDatosCaso)]),
      },
    } as unknown as PrismaService;
    const [cita] = await new CitasPsicologicasRepository(
      prisma,
    ).listarCitasEnRango({
      psicologaId: 'psicologa-a',
      desde: new Date('2026-01-01T06:00:00.000Z'),
      hasta: new Date('2027-01-01T05:59:59.999Z'),
    });
    return cita.tipologias;
  }

  it('incluye la tipología si Trabajo Social compartió los datos del caso', async () => {
    await expect(tipologiasCon(true)).resolves.toEqual(['FISICA']);
  });

  it.each([false, null])(
    'no incluye la tipología si los datos del caso no se compartieron (%s)',
    async (permiso) => {
      await expect(tipologiasCon(permiso)).resolves.toEqual([]);
    },
  );
});
