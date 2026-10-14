/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { IVisibilidadMedicaReader } from '../../medica/interfaces/visibilidad-medica-reader.interface';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import { VistaMedicaJuridicoService } from './vista-medica-juridico.service';

const CONTEXTO = { usuarioId: 'abogada-1' } as ContextoAuditoria;

describe('VistaMedicaJuridicoService', () => {
  let reader: jest.Mocked<IVisibilidadMedicaReader>;
  let storage: jest.Mocked<IObjectStorage>;
  let audit: jest.Mocked<AuditService>;
  let service: VistaMedicaJuridicoService;

  beforeEach(() => {
    reader = {
      paraJuridico: jest.fn().mockResolvedValue([]),
      constanciaParaJuridico: jest.fn().mockResolvedValue(null),
      paraPsicologia: jest.fn(),
    };
    storage = {
      generarUrlDescarga: jest
        .fn()
        .mockResolvedValue('https://firmada/descarga'),
      generarUrlVistaPrevia: jest
        .fn()
        .mockResolvedValue('https://firmada/vista'),
    } as unknown as jest.Mocked<IObjectStorage>;
    audit = { registrar: jest.fn() } as unknown as jest.Mocked<AuditService>;
    service = new VistaMedicaJuridicoService(reader, storage, audit);
  });

  it('una constancia no compartida (o inexistente) responde 403 sin firmar ni auditar', async () => {
    await expect(
      service.url('u-1', 'd-1', { modo: 'vista' }, CONTEXTO),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reader.constanciaParaJuridico).toHaveBeenCalledWith('u-1', 'd-1');
    expect(storage.generarUrlVistaPrevia).not.toHaveBeenCalled();
    expect(storage.generarUrlDescarga).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('firma la constancia compartida y audita DOCUMENTO_MEDICO_VISTO_POR_JURIDICO solo con ids', async () => {
    reader.constanciaParaJuridico.mockResolvedValue({
      documentoId: 'd-1',
      expedienteId: 'exp-1',
      claveObjeto: 'medica/exp-1/a-1/x',
      nombreArchivo: 'constancia.pdf',
      mimeType: 'application/pdf',
    });

    await expect(
      service.url('u-1', 'd-1', { modo: 'vista' }, CONTEXTO),
    ).resolves.toEqual({ url: 'https://firmada/vista' });

    const evento = audit.registrar.mock.calls[0][0];
    expect(evento).toMatchObject({
      accion: 'DOCUMENTO_MEDICO_VISTO_POR_JURIDICO',
      entidadId: 'd-1',
      detalles: { expedienteId: 'exp-1', modo: 'vista' },
    });
    expect(JSON.stringify(evento)).not.toContain('constancia.pdf');
  });
});
