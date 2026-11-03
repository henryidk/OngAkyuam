import type {
  AtencionMedicaParaEstado,
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
    atencionMedica: jest.fn().mockResolvedValue(null),
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

  it('muestra a las abogadas de los procesos abiertos, sin repetir, con su cargo', async () => {
    const repo = repositorio();
    repo.procesosJuridicos.mockResolvedValue([
      { fase: 'INICIADO', situacion: 'ACTIVO', abogada: 'Abogada A' },
      { fase: 'EN_PROCESO', situacion: 'ACTIVO', abogada: 'Abogada A' },
      { fase: 'FINALIZADO', situacion: 'ACTIVO', abogada: 'Abogada B' },
      { fase: 'INICIADO', situacion: 'ACTIVO', abogada: null },
    ]);

    const resultado = await new JuridicoEstadoResolver(repo).resolver(referido);

    expect(resultado.profesional).toBe('Abogada A (abogada)');
  });

  it('con todo cerrado muestra a quienes llevaron los procesos', async () => {
    const repo = repositorio();
    repo.procesosJuridicos.mockResolvedValue([
      { fase: 'FINALIZADO', situacion: 'ACTIVO', abogada: 'Abogada A' },
      { fase: 'FINALIZADO', situacion: 'ACTIVO', abogada: 'Abogada B' },
    ]);

    const resultado = await new JuridicoEstadoResolver(repo).resolver(referido);

    expect(resultado.profesional).toBe(
      'Abogada A (abogada), Abogada B (abogada)',
    );
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
  const activa: AtencionMedicaParaEstado = {
    estado: 'ACTIVA',
    motivoAlta: null,
    medica: null,
    fechaAlta: null,
    posteriorAReferencia: true,
    proximaCita: null,
    citaSinRegistrar: false,
  };
  const alta: AtencionMedicaParaEstado = {
    ...activa,
    estado: 'ALTA',
    motivoAlta: 'REFERIDA_OTRA_INSTITUCION',
    fechaAlta: '2026-10-09',
  };

  async function resolver(atencion: AtencionMedicaParaEstado | null) {
    const repo = repositorio();
    repo.atencionMedica.mockResolvedValue(atencion);
    return new MedicaEstadoResolver(repo).resolver(referido);
  }

  it('referida sin atención: pendiente de primera consulta', async () => {
    await expect(resolver(null)).resolves.toEqual({
      estado: 'ACTIVA',
      detalle: 'Pendiente de primera consulta',
      profesional: null,
    });
  });

  it('activa con cita: muestra la próxima consulta', async () => {
    const resultado = await resolver({
      ...activa,
      proximaCita: new Date('2026-10-16T16:00:00.000Z'),
    });
    expect(resultado.estado).toBe('ACTIVA');
    expect(resultado.detalle).toMatch(/^Próxima consulta /);
  });

  it('activa sin cita', async () => {
    await expect(resolver(activa)).resolves.toMatchObject({
      estado: 'ACTIVA',
      detalle: 'Sin consulta programada',
    });
  });

  it('una cita sin registrar manda sobre la próxima', async () => {
    await expect(
      resolver({
        ...activa,
        citaSinRegistrar: true,
        proximaCita: new Date('2026-10-16T16:00:00.000Z'),
      }),
    ).resolves.toMatchObject({
      estado: 'ACTIVA',
      detalle: 'Consulta sin registrar',
    });
  });

  it('alta: cerrada con el motivo y la fecha', async () => {
    await expect(resolver(alta)).resolves.toEqual({
      estado: 'CERRADA',
      detalle: 'Alta · Referida a otra institución · 09/10/2026',
      profesional: null,
    });
  });

  it('con atención vigente muestra a la médica que atiende, no la asignación al referir', async () => {
    const repo = repositorio();
    repo.atencionMedica.mockResolvedValue({
      ...activa,
      medica: 'Médica Ficticia (practicante)',
    });

    const resultado = await new MedicaEstadoResolver(repo).resolver({
      expedienteId: 'e-1',
      profesional: 'Asignada al referir',
    });

    expect(resultado.profesional).toBe('Médica Ficticia (practicante)');
  });

  it('pendiente de primera consulta: queda la asignación de Trabajo Social', async () => {
    const repo = repositorio();
    repo.atencionMedica.mockResolvedValue({
      ...alta,
      medica: 'Médica Anterior',
      posteriorAReferencia: false,
    });

    const resultado = await new MedicaEstadoResolver(repo).resolver({
      expedienteId: 'e-1',
      profesional: 'Asignada al referir',
    });

    expect(resultado.profesional).toBe('Asignada al referir');
  });

  it('alta seguida de una nueva referencia: vuelve a estar pendiente', async () => {
    await expect(
      resolver({ ...alta, posteriorAReferencia: false }),
    ).resolves.toMatchObject({
      estado: 'ACTIVA',
      detalle: 'Pendiente de primera consulta',
    });
  });
});
