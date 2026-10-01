/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EgresoService } from './egreso.service';
import type {
  ExpedienteParaEgreso,
  IEgresoRepository,
} from './interfaces/egreso-repository.interface';
import type { AuditService } from '../../auth/services/audit.service';

describe('EgresoService', () => {
  let service: EgresoService;
  let egresoRepository: jest.Mocked<IEgresoRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function expediente(
    overrides: Partial<ExpedienteParaEgreso> = {},
  ): ExpedienteParaEgreso {
    return {
      tipoRegistro: 'INTERNA',
      fechaIngresoAlbergue: '2026-01-10',
      fechaEgresoAlbergue: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    egresoRepository = {
      buscarExpediente: jest.fn(),
      registrarEgreso: jest.fn().mockResolvedValue(true),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new EgresoService(egresoRepository, auditService);
  });

  it('registra el egreso de una Interna en albergue y lo audita sin PII', async () => {
    egresoRepository.buscarExpediente.mockResolvedValue(expediente());

    const resultado = await service.registrar(
      'exp-1',
      { fechaEgreso: '2026-02-01' },
      contexto,
    );

    expect(resultado).toEqual({
      expedienteId: 'exp-1',
      fechaEgreso: '2026-02-01',
    });
    expect(egresoRepository.registrarEgreso).toHaveBeenCalledWith(
      'exp-1',
      '2026-02-01',
    );
    const auditoria = auditService.registrar.mock.calls[0][0];
    expect(auditoria.accion).toBe('EGRESO_ALBERGUE_REGISTRADO');
    expect(auditoria.entidadId).toBe('exp-1');
    expect(auditoria.detalles).toBeUndefined();
  });

  it('acepta el egreso el mismo día del ingreso', async () => {
    egresoRepository.buscarExpediente.mockResolvedValue(expediente());

    await expect(
      service.registrar('exp-1', { fechaEgreso: '2026-01-10' }, contexto),
    ).resolves.toBeDefined();
  });

  it('lanza 404 si el expediente no existe', async () => {
    egresoRepository.buscarExpediente.mockResolvedValue(null);

    await expect(
      service.registrar('exp-1', { fechaEgreso: '2026-02-01' }, contexto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(egresoRepository.registrarEgreso).not.toHaveBeenCalled();
  });

  it('lanza 409 si el caso es Externa', async () => {
    egresoRepository.buscarExpediente.mockResolvedValue(
      expediente({ tipoRegistro: 'EXTERNA', fechaIngresoAlbergue: null }),
    );

    await expect(
      service.registrar('exp-1', { fechaEgreso: '2026-02-01' }, contexto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(egresoRepository.registrarEgreso).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('lanza 409 si el egreso ya estaba registrado', async () => {
    egresoRepository.buscarExpediente.mockResolvedValue(
      expediente({ fechaEgresoAlbergue: '2026-01-20' }),
    );

    await expect(
      service.registrar('exp-1', { fechaEgreso: '2026-02-01' }, contexto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(egresoRepository.registrarEgreso).not.toHaveBeenCalled();
  });

  it('lanza 409 y no audita si otra petición registró el egreso primero', async () => {
    egresoRepository.buscarExpediente.mockResolvedValue(expediente());
    egresoRepository.registrarEgreso.mockResolvedValue(false);

    await expect(
      service.registrar('exp-1', { fechaEgreso: '2026-02-01' }, contexto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('lanza 400 si la fecha de egreso es anterior al ingreso', async () => {
    egresoRepository.buscarExpediente.mockResolvedValue(expediente());

    await expect(
      service.registrar('exp-1', { fechaEgreso: '2026-01-09' }, contexto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(egresoRepository.registrarEgreso).not.toHaveBeenCalled();
  });
});
