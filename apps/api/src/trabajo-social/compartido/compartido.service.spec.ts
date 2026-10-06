/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import type { AuditService } from '../../auth/services/audit.service';
import { CompartidoService } from './compartido.service';
import { EstrategiasCompartido } from './estrategias-compartido';
import type { ICompartidoRepository } from './interfaces/compartido-repository.interface';

describe('CompartidoService', () => {
  let service: CompartidoService;
  let repositorio: jest.Mocked<ICompartidoRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    repositorio = {
      areasReferidas: jest
        .fn()
        .mockResolvedValue(['JURIDICO', 'PSICOLOGIA', 'MEDICA']),
      procesosJuridicos: jest.fn().mockResolvedValue([]),
      proximaCitaPsicologica: jest.fn().mockResolvedValue(null),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new CompartidoService(
      repositorio,
      new EstrategiasCompartido(repositorio),
      auditService,
    );
  });

  it('lanza 404 si el expediente no existe y no audita', async () => {
    repositorio.areasReferidas.mockResolvedValue(null);

    await expect(service.obtener('exp-1', contexto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('devuelve una entrada por área, en el orden del catálogo', async () => {
    const compartido = await service.obtener('exp-1', contexto);

    expect(compartido.map((entrada) => entrada.area)).toEqual([
      'JURIDICO',
      'PSICOLOGIA',
      'MEDICA',
    ]);
  });

  it('Jurídico comparte tipo, estado, abogada y procuradora de cada proceso', async () => {
    repositorio.procesosJuridicos.mockResolvedValue([
      {
        tipo: 'GUARDA_CUSTODIA',
        fase: 'INICIADO',
        situacion: 'ACTIVO',
        abogada: 'Abogada Ficticia',
        procuradora: 'Procuradora Ficticia',
      },
      {
        tipo: 'MEDIDAS_SEGURIDAD',
        fase: 'FINALIZADO',
        situacion: 'ACTIVO',
        abogada: null,
        procuradora: null,
      },
    ]);

    const [juridico] = await service.obtener('exp-1', contexto);

    expect(juridico.lineas).toHaveLength(2);
    expect(juridico.lineas[0]).toContain('En trámite');
    expect(juridico.lineas[1]).toContain('Finalizado');
    expect(juridico.lineas[0]).toContain('Abogada: Abogada Ficticia');
    expect(juridico.lineas[0]).toContain('Procuradora: Procuradora Ficticia');
    expect(juridico.lineas[1]).not.toContain('Abogada');
  });

  it.each([
    ['INICIADO', 'ACTIVO', 'En trámite'],
    ['EN_PROCESO', 'ACTIVO', 'En trámite'],
    ['EN_PROCESO', 'SUSPENDIDO', 'Suspendido'],
    ['INICIADO', 'ABANDONADO', 'Abandonado'],
    // Un proceso finalizado se anuncia como tal aunque su situación haya quedado en otra cosa.
    ['FINALIZADO', 'ABANDONADO', 'Finalizado'],
  ] as const)(
    'Jurídico anuncia %s/%s como "%s"',
    async (fase, situacion, etiqueta) => {
      repositorio.procesosJuridicos.mockResolvedValue([
        {
          tipo: 'GUARDA_CUSTODIA',
          fase,
          situacion,
          abogada: null,
          procuradora: null,
        },
      ]);

      const [juridico] = await service.obtener('exp-1', contexto);

      expect(juridico.lineas[0]).toContain(etiqueta);
    },
  );

  it('Psicología comparte solo la próxima cita', async () => {
    repositorio.proximaCitaPsicologica.mockResolvedValue(
      new Date('2026-10-05T16:00:00.000Z'),
    );

    const compartido = await service.obtener('exp-1', contexto);
    const psicologia = compartido.find(
      (entrada) => entrada.area === 'PSICOLOGIA',
    );

    expect(psicologia?.lineas).toHaveLength(1);
    expect(psicologia?.lineas[0]).toMatch(/^Próxima cita: /);
  });

  it('Psicología nunca expone contenido clínico: el repositorio solo le entrega una fecha', async () => {
    // Aunque la fila de la cita trajera campos clínicos, la estrategia solo sabe formatear la
    // fecha: cualquier otro dato tendría que agregarse al contrato del repositorio primero.
    const citaConContenidoClinico = Object.assign(
      new Date('2026-10-05T16:00:00.000Z'),
      {
        motivo: 'MOTIVO-CLINICO',
        observaciones: 'OBSERVACION-CLINICA',
        acuerdos: 'ACUERDO-CLINICO',
      },
    );
    repositorio.proximaCitaPsicologica.mockResolvedValue(
      citaConContenidoClinico,
    );

    const respuesta = JSON.stringify(await service.obtener('exp-1', contexto));

    expect(respuesta).not.toContain('CLINIC');
  });

  it('Psicología sin cita programada no comparte nada', async () => {
    const compartido = await service.obtener('exp-1', contexto);

    expect(compartido[1]).toEqual({
      area: 'PSICOLOGIA',
      referida: true,
      lineas: [],
    });
  });

  it('no consulta a un área que no fue referida', async () => {
    repositorio.areasReferidas.mockResolvedValue(['JURIDICO']);

    const compartido = await service.obtener('exp-1', contexto);

    expect(repositorio.proximaCitaPsicologica).not.toHaveBeenCalled();
    expect(compartido[1]).toEqual({
      area: 'PSICOLOGIA',
      referida: false,
      lineas: [],
    });
  });

  it('audita la consulta sin detalles', async () => {
    await service.obtener('exp-1', contexto);

    const auditoria = auditService.registrar.mock.calls[0][0];
    expect(auditoria.accion).toBe('COMPARTIDO_AREAS_CONSULTADO');
    expect(auditoria.entidadId).toBe('exp-1');
    expect(auditoria.detalles).toBeUndefined();
  });
});
