/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import type { AuditService } from '../../auth/services/audit.service';
import { BitacoraService } from './bitacora.service';
import type {
  EventoBitacoraRow,
  IBitacoraRepository,
} from './interfaces/bitacora-repository.interface';

describe('BitacoraService', () => {
  let service: BitacoraService;
  let repositorio: jest.Mocked<IBitacoraRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'ts-1',
    username: 'trabajo_social',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  function fila(overrides: Partial<EventoBitacoraRow> = {}): EventoBitacoraRow {
    return {
      id: 'a-1',
      accion: 'EXPEDIENTE_CREADO',
      detalles: { numero: '05-2026' },
      createdAt: new Date('2026-09-01T15:00:00.000Z'),
      autor: 'Ana Trabajo Social',
      numeroExpediente: '05-2026',
      ...overrides,
    };
  }

  beforeEach(() => {
    repositorio = {
      existeUsuaria: jest.fn().mockResolvedValue(true),
      eventosDeUsuaria: jest.fn().mockResolvedValue([]),
    };
    auditService = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;
    service = new BitacoraService(repositorio, auditService);
  });

  it('responde 404 genérico y no audita si la usuaria no existe', async () => {
    repositorio.existeUsuaria.mockResolvedValue(false);

    await expect(service.obtener('u-x', contexto)).rejects.toThrow(
      NotFoundException,
    );
    expect(repositorio.eventosDeUsuaria).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('traduce cada evento a texto y marca los destacados', async () => {
    repositorio.eventosDeUsuaria.mockResolvedValue([
      fila({
        id: 'a-2',
        accion: 'DOCUMENTO_SUBIDO',
        detalles: { expedienteId: 'e-1', tipo: 'ENTREVISTA_USUARIA' },
      }),
      fila(),
    ]);

    const eventos = await service.obtener('u-1', contexto);

    expect(eventos).toEqual([
      {
        id: 'a-2',
        fecha: '2026-09-01T15:00:00.000Z',
        accion: 'DOCUMENTO_SUBIDO',
        texto: 'Subió «Entrevista a usuaria»',
        autor: 'Ana Trabajo Social',
        numeroExpediente: '05-2026',
        destacado: false,
      },
      expect.objectContaining({
        texto: 'Registró el caso 05-2026',
        destacado: true,
      }),
    ]);
  });

  it('pide al repositorio solo acciones de la lista blanca', async () => {
    await service.obtener('u-1', contexto);

    const [, acciones] = repositorio.eventosDeUsuaria.mock.calls[0];
    expect(acciones).toContain('EXPEDIENTE_REFERIDO');
    expect(acciones).not.toContain('EXPEDIENTE_CONSULTADO');
    expect(acciones).not.toContain('REGISTRO_CONSULTA_GUARDADO');
  });

  it('descarta una acción que el repositorio devuelva sin plantilla', async () => {
    repositorio.eventosDeUsuaria.mockResolvedValue([
      fila({ accion: 'EXPEDIENTE_CONSULTADO' }),
    ]);

    await expect(service.obtener('u-1', contexto)).resolves.toEqual([]);
  });

  it('audita la consulta sin datos personales en detalles', async () => {
    await service.obtener('u-1', contexto);

    expect(auditService.registrar).toHaveBeenCalledWith({
      usuarioId: 'ts-1',
      username: 'trabajo_social',
      accion: 'BITACORA_CONSULTADA',
      entidad: 'Usuaria',
      entidadId: 'u-1',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });
  });
});
