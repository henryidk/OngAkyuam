/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PoliticasAcceso } from '../../areas/politicas/politicas-acceso';
import type { AuditService } from '../../auth/services/audit.service';
import { AccesosService } from './accesos.service';
import type {
  ExpedienteParaAccesos,
  IAccesosRepository,
} from './interfaces/accesos-repository.interface';

const EXPEDIENTE_ID = '11111111-1111-4111-8111-111111111111';

const contexto = {
  usuarioId: 'ts-1',
  username: 'trabajo.social',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

/** Externa, referida a Jurídico y Psicología; solo la entrevista está subida. */
function expediente(): ExpedienteParaAccesos {
  return {
    id: EXPEDIENTE_ID,
    numero: '01-2026',
    tipoRegistro: 'EXTERNA',
    referidos: [
      { area: 'JURIDICO', puedeVerDatosCaso: true },
      { area: 'PSICOLOGIA', puedeVerDatosCaso: false },
    ],
    documentos: [
      {
        id: 'doc-entrevista',
        tipo: 'ENTREVISTA_USUARIA',
        version: 2,
        areasVisibles: ['PSICOLOGIA'],
      },
    ],
  };
}

describe('AccesosService', () => {
  let service: AccesosService;
  let repositorio: jest.Mocked<IAccesosRepository>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(() => {
    repositorio = {
      buscarExpediente: jest.fn().mockResolvedValue(expediente()),
      actualizar: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;
    service = new AccesosService(
      repositorio,
      new PoliticasAcceso(),
      auditService,
    );
  });

  describe('obtenerMatriz', () => {
    it('404 si el expediente no existe', async () => {
      repositorio.buscarExpediente.mockResolvedValue(null);
      await expect(service.obtenerMatriz(EXPEDIENTE_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('calcula las celdas con la misma política que aplican las áreas', async () => {
      const matriz = await service.obtenerMatriz(EXPEDIENTE_ID);

      // Externa: sin documentos de albergue.
      expect(matriz.filas.map((fila) => fila.clave)).toEqual([
        'DATOS_CASO',
        'ENTREVISTA_USUARIA',
        'ACCIONES_REALIZADAS',
      ]);
      expect(matriz.columnas).toEqual([
        { area: 'JURIDICO', referida: true, restringible: false },
        { area: 'PSICOLOGIA', referida: true, restringible: true },
        { area: 'MEDICA', referida: false, restringible: true },
      ]);

      const [datosCaso, entrevista, acciones] = matriz.filas;
      expect(datosCaso.celdas.JURIDICO).toEqual({
        visible: true,
        bloqueado: true,
        deshabilitado: false,
      });
      expect(datosCaso.celdas.PSICOLOGIA.visible).toBe(false);
      expect(datosCaso.celdas.MEDICA.deshabilitado).toBe(true);
      expect(entrevista.descripcion).toBe('Subido · v2');
      expect(entrevista.celdas.PSICOLOGIA.visible).toBe(true);
      expect(acciones.celdas.PSICOLOGIA).toEqual({
        visible: false,
        bloqueado: false,
        deshabilitado: true,
      });
    });
  });

  describe('actualizar', () => {
    it('400 para Jurídico: no se puede restringir', async () => {
      await expect(
        service.actualizar(
          EXPEDIENTE_ID,
          'JURIDICO',
          { datosCaso: false },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it('400 si el área no fue referida', async () => {
      await expect(
        service.actualizar(
          EXPEDIENTE_ID,
          'MEDICA',
          { datosCaso: true },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it('400 si el documento todavía no se ha subido', async () => {
      await expect(
        service.actualizar(
          EXPEDIENTE_ID,
          'PSICOLOGIA',
          { documentos: { ACCIONES_REALIZADAS: true } },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repositorio.actualizar).not.toHaveBeenCalled();
    });

    it('aplica el cambio sobre el documento vigente y lo audita sin PII', async () => {
      await service.actualizar(
        EXPEDIENTE_ID,
        'PSICOLOGIA',
        { datosCaso: true, documentos: { ENTREVISTA_USUARIA: false } },
        contexto,
      );

      expect(repositorio.actualizar).toHaveBeenCalledWith({
        expedienteId: EXPEDIENTE_ID,
        area: 'PSICOLOGIA',
        datosCaso: true,
        documentos: [{ documentoId: 'doc-entrevista', visible: false }],
        otorgadoPorId: 'ts-1',
      });
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ACCESO_AREA_MODIFICADO',
          entidadId: EXPEDIENTE_ID,
          detalles: {
            area: 'PSICOLOGIA',
            datosCaso: true,
            documentos: { ENTREVISTA_USUARIA: false },
          },
        }),
      );
    });
  });
});
