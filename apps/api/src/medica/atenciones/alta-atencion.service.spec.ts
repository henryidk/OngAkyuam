/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { altaAtencionMedicaSchema } from '@akyuam/shared';
import type { AuditService } from '../../auth/services/audit.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { AccesoMedicaService } from '../compartido/acceso-medica.service';
import type { AccesoAtencionMedica } from '../interfaces/acceso-medica-repository.interface';
import type { IAtencionesMedicasRepository } from '../interfaces/atenciones-medicas-repository.interface';
import { VersionCambioError } from '../interfaces/errores-medica';
import { AltaAtencionService } from './alta-atencion.service';

const CONTEXTO = { usuarioId: 'medica-1' } as ContextoAuditoria;
// Miércoles 14/10/2026, 09:00 en Guatemala.
const AHORA = new Date('2026-10-14T15:00:00.000Z');
const ATENCION: AccesoAtencionMedica = {
  atencionId: 'a-1',
  expedienteId: 'exp-1',
  expedienteNumero: '2026-0001',
  usuariaId: 'u-1',
  consecutivo: 1,
  estado: 'ACTIVA',
  version: 3,
};

describe('AltaAtencionService', () => {
  let repository: jest.Mocked<IAtencionesMedicasRepository>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let audit: jest.Mocked<AuditService>;
  let service: AltaAtencionService;

  beforeEach(() => {
    repository = {
      darAlta: jest.fn().mockResolvedValue(2),
    } as unknown as jest.Mocked<IAtencionesMedicasRepository>;
    acceso = {
      exigirAtencion: jest.fn().mockResolvedValue(ATENCION),
    } as unknown as jest.Mocked<AccesoMedicaService>;
    audit = { registrar: jest.fn() } as unknown as jest.Mocked<AuditService>;
    service = new AltaAtencionService(
      repository,
      { ahora: () => AHORA },
      acceso,
      audit,
    );
  });

  it('da de alta, informa las citas futuras canceladas y lo audita', async () => {
    await expect(
      service.darAlta(
        'a-1',
        { motivo: 'ALTA_MEDICA', nota: null, version: 3 } as never,
        CONTEXTO,
      ),
    ).resolves.toEqual({ atencionId: 'a-1', citasCanceladas: 2 });
    expect(repository.darAlta).toHaveBeenCalledWith(
      expect.objectContaining({
        atencionId: 'a-1',
        version: 3,
        fechaAlta: '2026-10-14',
        ahora: AHORA,
      }),
    );
    expect(audit.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'ATENCION_MEDICA_ALTA',
        detalles: expect.objectContaining({ citasCanceladas: 2 }) as unknown,
      }),
    );
  });

  it('una atención que ya tiene alta responde 409', async () => {
    acceso.exigirAtencion.mockResolvedValue({ ...ATENCION, estado: 'ALTA' });
    await expect(
      service.darAlta(
        'a-1',
        { motivo: 'ALTA_MEDICA', version: 3 } as never,
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.darAlta).not.toHaveBeenCalled();
  });

  it('una versión vieja responde 409 y no audita', async () => {
    repository.darAlta.mockRejectedValue(new VersionCambioError());
    await expect(
      service.darAlta(
        'a-1',
        { motivo: 'ALTA_MEDICA', version: 2 } as never,
        CONTEXTO,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.registrar).not.toHaveBeenCalled();
  });

  describe('validación del cuerpo (la misma que aplica el controlador)', () => {
    const pipe = new ZodValidationPipe(altaAtencionMedicaSchema);
    const body = { type: 'body' } as const;

    it('motivo OTRO sin nota responde 400', () => {
      expect(() =>
        pipe.transform({ motivo: 'OTRO', version: 3 }, body),
      ).toThrow(BadRequestException);
    });

    it('motivo OTRO con nota es válido', () => {
      expect(
        pipe.transform(
          { motivo: 'OTRO', nota: 'Se mudó de municipio', version: 3 },
          body,
        ),
      ).toEqual(expect.objectContaining({ motivo: 'OTRO' }));
    });
  });
});
