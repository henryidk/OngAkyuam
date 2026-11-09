import { ConflictException, type INestApplication } from '@nestjs/common';
import type { Usuario } from '@prisma/client';
import type { App } from 'supertest/types';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ReservasPsicologia } from '../../src/psicologia/compartido/reservas';
import {
  CasoYaTomadoError,
  PROCESOS_PSICOLOGIA_REPOSITORY,
  type IProcesosPsicologiaRepository,
} from '../../src/psicologia/interfaces/procesos-psicologia-repository.interface';
import {
  crearApp,
  crearExpediente,
  crearUsuario,
  instanteUnico,
} from './fixtures';

/**
 * En Psicología el caso se toma al confirmar su primera cita (o al registrar "Atender ahora"),
 * en una transacción Serializable con `FOR UPDATE` sobre el expediente. Dos psicólogas que
 * confirman la misma referencia a la vez: una sola se queda con el caso y nace un solo proceso.
 * Es de privacidad: si las dos ganaran, la segunda vería un caso que no le corresponde.
 *
 * Mientras se agenda, la referencia queda reservada en Redis: nadie más puede renovarla ni
 * soltarla, y quien no la tiene no puede guardar encima.
 */
describe('Tomar caso de Psicología en paralelo (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let repositorio: IProcesosPsicologiaRepository;
  let reservas: ReservasPsicologia;
  let ts: Usuario;
  let psicologas: Usuario[];

  beforeAll(async () => {
    app = await crearApp();
    prisma = app.get(PrismaService);
    repositorio = app.get(PROCESOS_PSICOLOGIA_REPOSITORY);
    reservas = app.get(ReservasPsicologia);
    ts = await crearUsuario(prisma, 'TRABAJO_SOCIAL');
    psicologas = await Promise.all(
      [1, 2, 3, 4].map(() => crearUsuario(prisma, 'PSICOLOGIA')),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  async function referenciaSinTomar() {
    const { usuaria, expediente } = await crearExpediente(prisma, ts.id, [
      'PSICOLOGIA',
    ]);
    return {
      expedienteId: expediente.id,
      referidoId: expediente.referidos[0].id,
      usuariaId: usuaria.id,
    };
  }

  function confirmarPrimeraCita(
    referencia: Awaited<ReturnType<typeof referenciaSinTomar>>,
    psicologa: Usuario,
  ) {
    return repositorio.abrir({
      ...referencia,
      psicologaId: psicologa.id,
      personas: [
        { ninoId: null, fechaHora: instanteUnico(), duracionMinutos: 60 },
      ],
    });
  }

  it('de cuatro confirmaciones simultáneas solo una toma el caso y queda un solo proceso, el 1', async () => {
    const referencia = await referenciaSinTomar();

    const resultados = await Promise.allSettled(
      psicologas.map((psicologa) =>
        confirmarPrimeraCita(referencia, psicologa),
      ),
    );

    const ganadoras = resultados.filter((r) => r.status === 'fulfilled');
    const perdedoras = resultados.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(ganadoras).toHaveLength(1);
    expect(perdedoras).toHaveLength(3);
    for (const perdedora of perdedoras) {
      expect(perdedora.reason).toBeInstanceOf(CasoYaTomadoError);
    }

    const procesos = await prisma.atencionPsicologica.findMany({
      where: { expedienteId: referencia.expedienteId },
      select: { consecutivo: true, psicologaAsignadaId: true },
    });
    const ganadora =
      psicologas[resultados.findIndex((r) => r.status === 'fulfilled')];
    expect(procesos).toEqual([
      { consecutivo: 1, psicologaAsignadaId: ganadora.id },
    ]);
  });

  it('confirmar un caso ya tomado no crea otro proceso ni cambia de dueña', async () => {
    const referencia = await referenciaSinTomar();
    const [primera, segunda] = psicologas;

    await confirmarPrimeraCita(referencia, primera);
    await expect(
      confirmarPrimeraCita(referencia, segunda),
    ).rejects.toBeInstanceOf(CasoYaTomadoError);

    const procesos = await prisma.atencionPsicologica.findMany({
      where: { expedienteId: referencia.expedienteId },
      select: { psicologaAsignadaId: true },
    });
    expect(procesos).toEqual([{ psicologaAsignadaId: primera.id }]);
  });

  describe('reserva mientras se agenda', () => {
    const personal = (psicologa: Usuario) => ({
      id: psicologa.id,
      nombreCompleto: psicologa.nombreCompleto,
    });

    it('de cuatro reservas simultáneas solo una queda y las demás reciben 409', async () => {
      const { referidoId } = await referenciaSinTomar();

      const resultados = await Promise.allSettled(
        psicologas.map((psicologa) =>
          reservas.reservar(referidoId, personal(psicologa), 'AGENDANDO'),
        ),
      );

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      for (const r of resultados.filter((r) => r.status === 'rejected')) {
        expect(r.reason).toBeInstanceOf(ConflictException);
      }
      const duena =
        psicologas[resultados.findIndex((r) => r.status === 'fulfilled')];
      await reservas.liberar(referidoId, duena.id);
    });

    it('otra persona no puede renovarla ni soltarla, y no puede guardar encima', async () => {
      const { referidoId } = await referenciaSinTomar();
      const [duena, otra] = psicologas;
      await reservas.reservar(referidoId, personal(duena), 'AGENDANDO');

      await expect(
        reservas.reservar(referidoId, personal(otra), 'AGENDANDO'),
      ).rejects.toBeInstanceOf(ConflictException);
      await reservas.liberar(referidoId, otra.id);
      await expect(
        reservas.exigirSinReservaAjena(referidoId, otra.id),
      ).rejects.toBeInstanceOf(ConflictException);

      // Sigue siendo de la dueña, con su nombre: es lo que ven las demás.
      await expect(reservas.vigentes([referidoId], otra.id)).resolves.toEqual([
        expect.objectContaining({
          nombre: duena.nombreCompleto,
          motivo: 'AGENDANDO',
          propia: false,
        }),
      ]);
      await expect(
        reservas.exigirSinReservaAjena(referidoId, duena.id),
      ).resolves.toBeUndefined();

      await reservas.liberar(referidoId, duena.id);
      await expect(reservas.vigentes([referidoId], otra.id)).resolves.toEqual([
        null,
      ]);
    });

    it('sin reserva vigente (la propia venció o se soltó) se puede guardar', async () => {
      const { referidoId } = await referenciaSinTomar();
      const [psicologa] = psicologas;
      await reservas.reservar(referidoId, personal(psicologa), 'ATENDIENDO');
      await reservas.liberar(referidoId, psicologa.id);

      await expect(
        reservas.exigirSinReservaAjena(referidoId, psicologa.id),
      ).resolves.toBeUndefined();
    });
  });
});
