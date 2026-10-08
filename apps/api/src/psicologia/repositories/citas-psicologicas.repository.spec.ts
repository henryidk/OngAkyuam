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
  borrador: false,
  reprogramadaDesdeId: null,
  atendidoPor: { nombreCompleto: 'Psicóloga A' },
  documentos: [],
};

function crearTx() {
  return {
    citaPsicologica: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ atencionId: 'proceso-1', ninoId: 'nino-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({ id: 'cita-2' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(CITA),
    },
    atencionPsicologica: {
      // 1ª llamada: bloqueo del proceso abierto. 2ª: paso de Inicio a Seguimiento.
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
    borrador: false,
    proximaCita: null,
    ...cambios,
  };
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

  it('solo escribe si el proceso sigue abierto y es de esa psicóloga', async () => {
    tx.atencionPsicologica.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(repository.registrarConsulta(params())).resolves.toBeNull();

    expect(tx.atencionPsicologica.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'proceso-1',
          psicologaAsignadaId: 'psicologa-a',
          estado: { not: 'CIERRE' },
        },
      }),
    );
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
        where: { id: 'cita-1', estado: { not: 'REPROGRAMADA' } },
      }),
    );
    expect(tx.cambioEstadoAtencion.create).not.toHaveBeenCalled();
    expect(tx.citaPsicologica.create).not.toHaveBeenCalled();
  });

  it('la primera sesión atendida pasa el proceso a Seguimiento y deja el hito', async () => {
    const resultado = await repository.registrarConsulta(params());

    expect(resultado?.pasoASeguimiento).toBe(true);
    expect(tx.atencionPsicologica.updateMany).toHaveBeenLastCalledWith(
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
    tx.atencionPsicologica.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

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
      expect(tx.atencionPsicologica.updateMany).toHaveBeenCalledTimes(1);
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
