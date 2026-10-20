/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE,
  MENSAJE_RESULTADO_ANTES_DE_TIEMPO,
  MENSAJE_SIN_ACCESO_AUDIENCIA,
} from '../compartido/mensajes';
import type { DocumentosProcesoService } from '../documentos/documentos-proceso.service';
import type { ICarpetasRepository } from '../interfaces/documentos-proceso-repository.interface';
import {
  AUDIENCIA_ID,
  CARPETA_ID,
  PROCESO_ID,
  accionesAuditadas,
  audienciaParaEscritura,
  contexto,
  crearAudienciasRepository,
  crearAuditService,
  escrituraOk,
  relojFijo,
} from '../pruebas/dobles';
import { ResultadoAudienciasService } from './resultado-audiencias.service';

// El servicio de documentos (doble abajo) arrastra Redis, que importa ESM que Jest no transforma.
jest.mock('../../redis/redis.service', () => ({
  RedisService: class RedisService {},
}));

/** Martes 20/10/2026 08:00 en Guatemala: ya pasó, pide resultado. */
const PASADA = new Date('2026-10-20T14:00:00.000Z');

describe('ResultadoAudienciasService', () => {
  let audiencias: ReturnType<typeof crearAudienciasRepository>;
  let carpetas: jest.Mocked<Pick<ICarpetasRepository, 'obtenerOCrear'>>;
  let documentos: { subir: jest.Mock };
  let auditService: ReturnType<typeof crearAuditService>;
  let service: ResultadoAudienciasService;

  beforeEach(() => {
    audiencias = crearAudienciasRepository();
    audiencias.buscarParaEscritura.mockResolvedValue(
      audienciaParaEscritura({ inicio: PASADA }),
    );
    carpetas = { obtenerOCrear: jest.fn().mockResolvedValue(CARPETA_ID) };
    documentos = { subir: jest.fn().mockResolvedValue({ id: 'documento' }) };
    auditService = crearAuditService();
    service = new ResultadoAudienciasService(
      audiencias,
      carpetas as unknown as ICarpetasRepository,
      documentos as unknown as DocumentosProcesoService,
      // Jueves 22/10/2026 09:00 en Guatemala.
      relojFijo(new Date('2026-10-22T15:00:00.000Z')),
      auditService,
    );
  });

  const resultado = (parcial = {}) => ({
    resultado: 'REALIZADA' as const,
    observaciones: '',
    motivo: '',
    numeroJudicial: null,
    version: 2,
    ...parcial,
  });

  describe('registrarResultado', () => {
    it('403 si la audiencia no es de Jurídico, sin escribir', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(null);

      await expect(
        service.registrarResultado(AUDIENCIA_ID, resultado(), contexto),
      ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_AUDIENCIA));
      expect(audiencias.registrarResultado).not.toHaveBeenCalled();
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    it('409 con mensaje propio si todavía no llega la hora', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(
        audienciaParaEscritura({ inicio: new Date('2026-10-23T15:00:00Z') }),
      );

      await expect(
        service.registrarResultado(AUDIENCIA_ID, resultado(), contexto),
      ).rejects.toThrow(
        new ConflictException(MENSAJE_RESULTADO_ANTES_DE_TIEMPO),
      );
      expect(audiencias.registrarResultado).not.toHaveBeenCalled();
    });

    it('409 genérico si ya tiene resultado', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(
        audienciaParaEscritura({ inicio: PASADA, estado: 'REALIZADA' }),
      );

      await expect(
        service.registrarResultado(AUDIENCIA_ID, resultado(), contexto),
      ).rejects.toThrow(
        new ConflictException(MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE),
      );
    });

    it('se puede registrar aunque el proceso ya esté cerrado', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(
        audienciaParaEscritura({ inicio: PASADA, procesoAbierto: false }),
      );

      await service.registrarResultado(AUDIENCIA_ID, resultado(), contexto);

      expect(audiencias.registrarResultado).toHaveBeenCalled();
    });

    it('una realizada descarta el motivo y guarda observaciones vacías como null', async () => {
      await service.registrarResultado(
        AUDIENCIA_ID,
        resultado({ motivo: 'no aplica' }),
        contexto,
      );

      expect(audiencias.registrarResultado).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        audienciaId: AUDIENCIA_ID,
        version: 2,
        usuarioId: contexto.usuarioId,
        resultado: 'REALIZADA',
        observaciones: null,
        motivo: null,
        numeroJudicial: null,
        textoBitacora: 'Audiencia del 20/10/2026 08:00: realizada',
      });
    });

    it('una no realizada guarda su motivo y audita solo el resultado', async () => {
      await service.registrarResultado(
        AUDIENCIA_ID,
        resultado({
          resultado: 'NO_REALIZADA',
          motivo: 'No se presentó la parte demandada',
        }),
        contexto,
      );

      expect(audiencias.registrarResultado).toHaveBeenCalledWith(
        expect.objectContaining({
          motivo: 'No se presentó la parte demandada',
          textoBitacora: 'Audiencia del 20/10/2026 08:00: no se realizó',
        }),
      );
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'AUDIENCIA_RESULTADO',
          detalles: { procesoId: PROCESO_ID, resultado: 'NO_REALIZADA' },
        }),
      );
      expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
        'demandada',
      );
    });

    it('audita el No. judicial si se aprovechó para guardarlo', async () => {
      audiencias.registrarResultado.mockResolvedValue(
        escrituraOk({ numeroJudicialAsignado: true }),
      );

      await service.registrarResultado(
        AUDIENCIA_ID,
        resultado({ numeroJudicial: 'C-02-2026' }),
        contexto,
      );

      expect(accionesAuditadas(auditService)).toEqual([
        'AUDIENCIA_RESULTADO',
        'PROCESO_NUMERO_JUDICIAL',
      ]);
    });
  });

  describe('editarObservaciones', () => {
    it('409 si la audiencia no tiene resultado', async () => {
      await expect(
        service.editarObservaciones(
          AUDIENCIA_ID,
          { observaciones: 'Algo', version: 2 },
          contexto,
        ),
      ).rejects.toThrow(
        new ConflictException(MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE),
      );
      expect(audiencias.editarObservaciones).not.toHaveBeenCalled();
    });

    it('guarda en una realizada sin poner el texto en la bitácora ni en la auditoría', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(
        audienciaParaEscritura({ inicio: PASADA, estado: 'REALIZADA' }),
      );

      await service.editarObservaciones(
        AUDIENCIA_ID,
        { observaciones: 'Texto sensible ficticio', version: 2 },
        contexto,
      );

      const params = audiencias.editarObservaciones.mock.calls[0][0];
      expect(params.observaciones).toBe('Texto sensible ficticio');
      expect(params.textoBitacora).not.toContain('sensible');
      expect(accionesAuditadas(auditService)).toEqual([
        'AUDIENCIA_OBSERVACIONES',
      ]);
      expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
        'sensible',
      );
    });
  });

  describe('subirDocumento', () => {
    const archivo = { originalname: 'acta.pdf' } as Express.Multer.File;

    it('403 si la audiencia no es de Jurídico: ni carpeta ni subida', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(null);

      await expect(
        service.subirDocumento(AUDIENCIA_ID, { archivo }, contexto),
      ).rejects.toThrow(ForbiddenException);
      expect(carpetas.obtenerOCrear).not.toHaveBeenCalled();
      expect(documentos.subir).not.toHaveBeenCalled();
    });

    it.each(['CANCELADA', 'REPROGRAMADA'] as const)(
      '409 en una %s',
      async (estado) => {
        audiencias.buscarParaEscritura.mockResolvedValue(
          audienciaParaEscritura({ estado }),
        );

        await expect(
          service.subirDocumento(AUDIENCIA_ID, { archivo }, contexto),
        ).rejects.toThrow(ConflictException);
        expect(documentos.subir).not.toHaveBeenCalled();
      },
    );

    it('sube a la carpeta Audiencias del proceso de la audiencia, enlazado a ella', async () => {
      await service.subirDocumento(
        AUDIENCIA_ID,
        { archivo, nombreVisible: 'Acta', tanda: 'tanda-0001' },
        contexto,
      );

      expect(carpetas.obtenerOCrear).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        nombre: 'Audiencias',
        creadaPorId: contexto.usuarioId,
      });
      expect(documentos.subir).toHaveBeenCalledWith(
        {
          archivo,
          nombreVisible: 'Acta',
          tanda: 'tanda-0001',
          procesoId: PROCESO_ID,
          carpetaId: CARPETA_ID,
          audienciaId: AUDIENCIA_ID,
        },
        contexto,
      );
    });
  });
});
