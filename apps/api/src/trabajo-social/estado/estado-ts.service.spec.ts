/* eslint-disable @typescript-eslint/unbound-method */
import { combinarEstadoTs, EstadoTsService } from './estado-ts.service';
import type { IEstadoAreasRepository } from './interfaces/estado-areas-repository.interface';
import { ResolveresEstadoArea } from './resolveres-estado-area';

describe('combinarEstadoTs', () => {
  it.each([
    [[], 'SIN_REFERIR'],
    [['ACTIVA'], 'EN_ATENCION'],
    [['CERRADA', 'ACTIVA'], 'EN_ATENCION'],
    [['CERRADA', 'CERRADA'], 'SIN_ATENCION_ACTIVA'],
  ] as const)('%j → %s', (estados, esperado) => {
    expect(combinarEstadoTs([...estados])).toBe(esperado);
  });
});

describe('EstadoTsService', () => {
  let repositorio: jest.Mocked<IEstadoAreasRepository>;
  let service: EstadoTsService;
  const referidoEn = new Date('2026-03-01T16:00:00.000Z');

  beforeEach(() => {
    repositorio = {
      procesosJuridicos: jest.fn().mockResolvedValue([]),
      atencionPsicologica: jest.fn().mockResolvedValue(null),
    };
    service = new EstadoTsService(new ResolveresEstadoArea(repositorio));
  });

  it('sin referidos el caso queda sin referir y sin consultar a ninguna área', async () => {
    await expect(service.resolverCaso([])).resolves.toEqual({
      estado: 'SIN_REFERIR',
      areas: [],
    });
    expect(repositorio.procesosJuridicos).not.toHaveBeenCalled();
    expect(repositorio.atencionPsicologica).not.toHaveBeenCalled();
  });

  it('combina el estado de cada área referida y conserva prioridad y fecha del referido', async () => {
    repositorio.procesosJuridicos.mockResolvedValue([
      { fase: 'FINALIZADO', situacion: 'ACTIVO' },
    ]);
    repositorio.atencionPsicologica.mockResolvedValue({
      estado: 'CIERRE',
      psicologa: 'Psicóloga Ficticia',
      proximaCita: null,
    });

    const resultado = await service.resolverCaso([
      {
        expedienteId: 'e-1',
        area: 'JURIDICO',
        prioridad: 'NORMAL',
        profesional: null,
        createdAt: referidoEn,
      },
      {
        expedienteId: 'e-1',
        area: 'PSICOLOGIA',
        prioridad: 'URGENTE',
        profesional: null,
        createdAt: referidoEn,
      },
    ]);

    expect(resultado.estado).toBe('SIN_ATENCION_ACTIVA');
    expect(resultado.areas).toEqual([
      expect.objectContaining({ area: 'JURIDICO', estado: 'CERRADA' }),
      expect.objectContaining({
        area: 'PSICOLOGIA',
        estado: 'CERRADA',
        profesional: 'Psicóloga Ficticia',
        referidoEn: referidoEn.toISOString(),
      }),
    ]);
    expect(repositorio.procesosJuridicos).toHaveBeenCalledWith('e-1');
  });

  it('con una sola área activa el caso sigue en atención', async () => {
    repositorio.procesosJuridicos.mockResolvedValue([
      { fase: 'FINALIZADO', situacion: 'ACTIVO' },
    ]);

    const resultado = await service.resolverCaso([
      {
        expedienteId: 'e-1',
        area: 'JURIDICO',
        prioridad: 'NORMAL',
        profesional: null,
        createdAt: referidoEn,
      },
      {
        expedienteId: 'e-1',
        area: 'MEDICA',
        prioridad: 'NORMAL',
        profesional: null,
        createdAt: referidoEn,
      },
    ]);

    expect(resultado.estado).toBe('EN_ATENCION');
  });
});
