/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { MENSAJE_SIN_ACCESO_REFERENCIA } from '../compartido/mensajes';
import type { IReferenciasRepository } from '../interfaces/referencias-repository.interface';
import {
  EXPEDIENTE_ID,
  REFERIDO_ID,
  contexto,
  crearAuditService,
} from '../pruebas/dobles';
import { BandejaJuridicoService } from './bandeja-juridico.service';

describe('BandejaJuridicoService', () => {
  let referencias: jest.Mocked<IReferenciasRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: BandejaJuridicoService;

  beforeEach(() => {
    referencias = {
      listar: jest.fn().mockResolvedValue([]),
      buscarPendientePorExpediente: jest.fn(),
      devolver: jest.fn().mockResolvedValue({ expedienteId: EXPEDIENTE_ID }),
    };
    auditService = crearAuditService();
    service = new BandejaJuridicoService(referencias, auditService);
  });

  it('devuelve la referencia y audita sobre el expediente, sin el motivo', async () => {
    await service.devolver(REFERIDO_ID, { motivo: 'Texto libre' }, contexto);

    expect(referencias.devolver).toHaveBeenCalledWith({
      referidoId: REFERIDO_ID,
      motivo: 'Texto libre',
      devueltoPorId: contexto.usuarioId,
    });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REFERENCIA_JURIDICO_DEVUELTA',
        entidad: 'Expediente',
        entidadId: EXPEDIENTE_ID,
        detalles: { referidoId: REFERIDO_ID, area: 'JURIDICO' },
      }),
    );
  });

  it('403 uniforme si la referencia no existe, es de otra área o ya no está pendiente', async () => {
    referencias.devolver.mockResolvedValue(null);

    await expect(
      service.devolver(REFERIDO_ID, { motivo: 'Texto libre' }, contexto),
    ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_REFERENCIA));
    expect(auditService.registrar).not.toHaveBeenCalled();
  });
});
