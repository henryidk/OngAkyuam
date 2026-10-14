/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import type { IObjectStorage } from '../../storage/interfaces/object-storage.interface';
import type { AccesoMedicaService } from '../compartido/acceso-medica.service';
import type { IDocumentosMedicosRepository } from '../interfaces/documentos-medicos-repository.interface';
import { DocumentosMedicosService } from './documentos-medicos.service';

const CONTEXTO = { usuarioId: 'medica-1' } as ContextoAuditoria;
// Cabecera mínima de un PDF: el validador revisa los primeros bytes, no la extensión.
const PDF = Buffer.from('%PDF-1.7\n');
const ARCHIVO = {
  buffer: PDF,
  mimetype: 'application/pdf',
  originalname: 'resultado.pdf',
  size: PDF.length,
} as Express.Multer.File;

describe('DocumentosMedicosService', () => {
  let repository: jest.Mocked<IDocumentosMedicosRepository>;
  let storage: jest.Mocked<IObjectStorage>;
  let acceso: jest.Mocked<AccesoMedicaService>;
  let audit: jest.Mocked<AuditService>;
  let service: DocumentosMedicosService;

  beforeEach(() => {
    repository = {
      crearPendiente: jest.fn(),
      crearEnConsulta: jest.fn(),
      buscarPendiente: jest.fn().mockResolvedValue(null),
      cambiarTipoPendiente: jest.fn(),
      eliminarPendiente: jest.fn(),
      listarPorUsuaria: jest.fn(),
    } as unknown as jest.Mocked<IDocumentosMedicosRepository>;
    storage = {
      subirObjeto: jest.fn(),
      eliminarObjeto: jest.fn().mockResolvedValue(undefined),
      generarUrlDescarga: jest
        .fn()
        .mockResolvedValue('https://firmada/descarga'),
      generarUrlVistaPrevia: jest
        .fn()
        .mockResolvedValue('https://firmada/vista'),
    };
    acceso = {
      exigirDocumento: jest.fn(),
      exigirAtencion: jest.fn(),
      exigirConsulta: jest.fn(),
      exigirUsuaria: jest.fn(),
    } as unknown as jest.Mocked<AccesoMedicaService>;
    audit = { registrar: jest.fn() } as unknown as jest.Mocked<AuditService>;
    service = new DocumentosMedicosService(
      repository,
      storage,
      { ahora: () => new Date('2026-10-14T15:00:00.000Z') },
      acceso,
      audit,
    );
  });

  describe('url', () => {
    it('sin acceso no firma ninguna URL ni audita', async () => {
      acceso.exigirDocumento.mockRejectedValue(new ForbiddenException());
      await expect(
        service.url('doc-1', { modo: 'descarga' }, CONTEXTO),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.generarUrlDescarga).not.toHaveBeenCalled();
      expect(storage.generarUrlVistaPrevia).not.toHaveBeenCalled();
      expect(audit.registrar).not.toHaveBeenCalled();
    });

    it.each([
      ['vista', 'DOCUMENTO_MEDICO_VISTO', 'https://firmada/vista'],
      ['descarga', 'DOCUMENTO_MEDICO_DESCARGADO', 'https://firmada/descarga'],
    ] as const)('modo %s firma y audita %s', async (modo, accion, url) => {
      acceso.exigirDocumento.mockResolvedValue({
        documentoId: 'doc-1',
        expedienteId: 'exp-1',
        expedienteNumero: '2026-0001',
        usuariaId: 'u-1',
        claveObjeto: 'medica/exp-1/a-1/x',
        nombreArchivo: 'resultado.pdf',
        mimeType: 'application/pdf',
      });
      await expect(service.url('doc-1', { modo }, CONTEXTO)).resolves.toEqual({
        url,
      });
      expect(audit.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion, entidadId: 'doc-1' }),
      );
    });
  });

  describe('pendientes', () => {
    it('el pendiente de otra persona responde 403 y no borra nada', async () => {
      await expect(
        service.eliminarPendiente('p-1', CONTEXTO),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(repository.buscarPendiente).toHaveBeenCalledWith(
        'p-1',
        'medica-1',
      );
      expect(storage.eliminarObjeto).not.toHaveBeenCalled();
      expect(repository.eliminarPendiente).not.toHaveBeenCalled();
    });

    it('no se sube a una atención que ya no está activa', async () => {
      acceso.exigirAtencion.mockResolvedValue({
        atencionId: 'a-1',
        expedienteId: 'exp-1',
        expedienteNumero: '2026-0001',
        usuariaId: 'u-1',
        consecutivo: 1,
        estado: 'ALTA',
        version: 3,
      });
      await expect(
        service.subirPendiente(
          ARCHIVO,
          {
            atencionId: 'a-1',
            lote: 'lote-1',
            tipo: 'RESULTADO_LABORATORIO',
          } as never,
          CONTEXTO,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(storage.subirObjeto).not.toHaveBeenCalled();
    });

    it('si la fila no se crea, borra el objeto recién subido', async () => {
      acceso.exigirConsulta.mockResolvedValue({
        consultaId: 'k-1',
        atencionId: 'a-1',
        expedienteId: 'exp-1',
        expedienteNumero: '2026-0001',
        usuariaId: 'u-1',
        consecutivo: 1,
        estado: 'ACTIVA',
        version: 1,
      });
      repository.crearEnConsulta.mockRejectedValue(new Error('falla'));
      await expect(
        service.subirAConsulta(
          'k-1',
          ARCHIVO,
          { tipo: 'RESULTADO_LABORATORIO' } as never,
          CONTEXTO,
        ),
      ).rejects.toThrow('falla');
      const clave = storage.subirObjeto.mock.calls[0][0];
      expect(clave).toMatch(/^medica\/exp-1\/a-1\/[0-9a-f-]{36}$/);
      expect(clave).not.toContain('resultado');
      expect(storage.eliminarObjeto).toHaveBeenCalledWith(clave);
    });
  });
});
