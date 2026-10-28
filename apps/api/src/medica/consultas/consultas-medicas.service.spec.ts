/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import type { ConsultasMedicasPaginaDto } from '@akyuam/shared';
import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { AccesoMedicaService } from '../compartido/acceso-medica.service';
import type { IConsultasMedicasRepository } from '../interfaces/consultas-medicas-repository.interface';
import { ConsultasMedicasService } from './consultas-medicas.service';

const CONTEXTO = { usuarioId: 'medica-1' } as ContextoAuditoria;
const PAGINA = {
  items: [{}, {}],
  siguienteCursor: 'c-2',
} as unknown as ConsultasMedicasPaginaDto;

describe('ConsultasMedicasService.historia', () => {
  let repository: jest.Mocked<IConsultasMedicasRepository>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let audit: jest.Mocked<AuditService>;
  let service: ConsultasMedicasService;

  beforeEach(() => {
    repository = {
      listarPorUsuaria: jest.fn().mockResolvedValue(PAGINA),
    } as unknown as jest.Mocked<IConsultasMedicasRepository>;
    acceso = {
      exigirUsuaria: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccesoMedicaService>;
    audit = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditService>;
    service = new ConsultasMedicasService(repository, acceso, audit);
  });

  it('audita cada página de la historia clínica, sin contenido clínico', async () => {
    await expect(
      service.historia('u-1', { cursor: 'c-1' }, CONTEXTO),
    ).resolves.toBe(PAGINA);
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'HISTORIA_CLINICA_MEDICA_CONSULTADA',
        entidad: 'Usuaria',
        entidadId: 'u-1',
        detalles: { persona: 'todas', pagina: 'siguiente', resultados: 2 },
      }),
    );
  });

  it('sin acceso a la paciente no lee ni audita', async () => {
    acceso.exigirUsuaria.mockRejectedValue(new ForbiddenException());
    await expect(service.historia('u-1', {}, CONTEXTO)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.listarPorUsuaria).not.toHaveBeenCalled();
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  it('si la auditoría falla no devuelve la historia', async () => {
    audit.registrar.mockRejectedValue(new Error('audit caído'));
    await expect(service.historia('u-1', {}, CONTEXTO)).rejects.toThrow(
      'audit caído',
    );
  });
});
