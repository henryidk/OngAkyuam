/* eslint-disable @typescript-eslint/unbound-method */
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let create: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    create = jest.fn().mockResolvedValue({});
    service = new AuditService({
      auditLog: { create },
    } as unknown as PrismaService);
  });

  it('avisa a los oyentes después de guardar el evento', async () => {
    const oyente = jest.fn(() => {
      expect(create).toHaveBeenCalled();
    });
    service.alRegistrar(oyente);

    await service.registrar({ accion: 'EXPEDIENTE_CREADO' });

    expect(oyente).toHaveBeenCalledWith({ accion: 'EXPEDIENTE_CREADO' });
  });

  it('un oyente que falla no rompe la operación auditada', async () => {
    const siguiente = jest.fn();
    service.alRegistrar(() => {
      throw new Error('socket caído');
    });
    service.alRegistrar(siguiente);

    await expect(
      service.registrar({ accion: 'EXPEDIENTE_CREADO' }),
    ).resolves.toBeUndefined();
    expect(siguiente).toHaveBeenCalled();
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it('si falla el guardado no avisa a nadie', async () => {
    const oyente = jest.fn();
    service.alRegistrar(oyente);
    create.mockRejectedValue(new Error('BD caída'));

    await expect(service.registrar({ accion: 'X' })).rejects.toThrow();
    expect(oyente).not.toHaveBeenCalled();
  });
});
