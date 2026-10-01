import type {
  IEstadoAreasRepository,
  ProcesoJuridicoParaEstado,
} from '../interfaces/estado-areas-repository.interface';
import { JuridicoEstadoResolver } from './juridico-estado.resolver';
import { MedicaEstadoResolver } from './medica-estado.resolver';
import { PsicologiaEstadoResolver } from './psicologia-estado.resolver';

const referido = { expedienteId: 'e-1', profesional: null };

function repositorio(): jest.Mocked<IEstadoAreasRepository> {
  return {
    procesosJuridicos: jest.fn().mockResolvedValue([]),
    atencionPsicologica: jest.fn().mockResolvedValue(null),
  };
}

describe('JuridicoEstadoResolver', () => {
  it.each([
    [[], 'ACTIVA', 'Sin procesos abiertos todavía'],
    [[['INICIADO', 'ACTIVO']], 'ACTIVA', '1 proceso activo'],
    [
      [
        ['INICIADO', 'ACTIVO'],
        ['EN_PROCESO', 'ACTIVO'],
        ['FINALIZADO', 'ACTIVO'],
      ],
      'ACTIVA',
      '2 procesos activos',
    ],
    [
      [
        ['FINALIZADO', 'ACTIVO'],
        ['FINALIZADO', 'ACTIVO'],
      ],
      'CERRADA',
      'Procesos cerrados',
    ],
    // Suspendido es una pausa: Jurídico sigue llevando el caso.
    [[['EN_PROCESO', 'SUSPENDIDO']], 'ACTIVA', '1 proceso activo'],
    // Abandonado deja de contar como activo…
    [[['EN_PROCESO', 'ABANDONADO']], 'CERRADA', 'Procesos cerrados'],
    [
      [
        ['INICIADO', 'ABANDONADO'],
        ['FINALIZADO', 'ACTIVO'],
      ],
      'CERRADA',
      'Procesos cerrados',
    ],
    // …pero no arrastra a los demás procesos de la usuaria.
    [
      [
        ['EN_PROCESO', 'ABANDONADO'],
        ['INICIADO', 'ACTIVO'],
      ],
      'ACTIVA',
      '1 proceso activo',
    ],
  ] as const)('procesos %j → %s', async (pares, estado, detalle) => {
    const procesos: ProcesoJuridicoParaEstado[] = pares.map(
      (par: readonly [string, string]) =>
        ({ fase: par[0], situacion: par[1] }) as ProcesoJuridicoParaEstado,
    );
    const repo = repositorio();
    repo.procesosJuridicos.mockResolvedValue(procesos);

    await expect(
      new JuridicoEstadoResolver(repo).resolver(referido),
    ).resolves.toEqual({ estado, detalle, profesional: null });
  });
});

describe('PsicologiaEstadoResolver', () => {
  it('sin atención registrada está en la cola del área, activa', async () => {
    const resultado = await new PsicologiaEstadoResolver(
      repositorio(),
    ).resolver({ expedienteId: 'e-1', profesional: 'Asignada al referir' });

    expect(resultado).toEqual({
      estado: 'ACTIVA',
      detalle: 'En cola · sin psicóloga asignada',
      profesional: 'Asignada al referir',
    });
  });

  it('el cierre manda aunque no haya psicóloga (igual que la condición SQL)', async () => {
    const repo = repositorio();
    repo.atencionPsicologica.mockResolvedValue({
      estado: 'CIERRE',
      psicologa: null,
      proximaCita: null,
    });

    const resultado = await new PsicologiaEstadoResolver(repo).resolver(
      referido,
    );

    expect(resultado.estado).toBe('CERRADA');
  });

  it('con psicóloga muestra la próxima cita o que no hay ninguna', async () => {
    const repo = repositorio();
    repo.atencionPsicologica.mockResolvedValueOnce({
      estado: 'SEGUIMIENTO',
      psicologa: 'Psicóloga Ficticia',
      proximaCita: new Date('2026-10-05T15:30:00.000Z'),
    });
    repo.atencionPsicologica.mockResolvedValueOnce({
      estado: 'INICIO',
      psicologa: 'Psicóloga Ficticia',
      proximaCita: null,
    });
    const resolver = new PsicologiaEstadoResolver(repo);

    const conCita = await resolver.resolver(referido);
    const sinCita = await resolver.resolver(referido);

    expect(conCita.estado).toBe('ACTIVA');
    expect(conCita.detalle).toMatch(/^Próxima cita /);
    expect(conCita.profesional).toBe('Psicóloga Ficticia');
    expect(sinCita.detalle).toBe('Sin cita programada');
  });
});

describe('MedicaEstadoResolver', () => {
  it('mientras no exista cierre médico, referida = activa', async () => {
    await expect(
      new MedicaEstadoResolver().resolver(referido),
    ).resolves.toEqual({
      estado: 'ACTIVA',
      detalle: 'Referida',
      profesional: null,
    });
  });
});
