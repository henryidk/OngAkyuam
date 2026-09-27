/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { AtencionPsicologicaDetalle } from '@akyuam/shared';
import { ProcesoPsicologicoService } from './proceso-psicologico.service';
import type { AccesoPsicologiaService } from './acceso-psicologia.service';
import type { IAtencionPsicologicaRepository } from '../interfaces/atencion-psicologica-repository.interface';
import type { AuditService } from '../../auth/services/audit.service';

function crearAtencion(
  overrides: Partial<AtencionPsicologicaDetalle> = {},
): AtencionPsicologicaDetalle {
  return {
    id: 'atencion-1',
    expedienteId: 'exp-1',
    estado: 'INICIO',
    psicologaAsignada: 'Psicóloga A',
    tomadaEn: '2026-09-01T12:00:00.000Z',
    fechaInicio: null,
    fechaCierre: null,
    motivoCierre: null,
    actualizadoPor: 'Psicóloga A',
    actualizadoEn: '2026-09-01T12:00:00.000Z',
    citas: [],
    historialEstados: [],
    ...overrides,
  };
}

describe('ProcesoPsicologicoService', () => {
  let service: ProcesoPsicologicoService;
  let acceso: jest.Mocked<AccesoPsicologiaService>;
  let atencionRepository: jest.Mocked<IAtencionPsicologicaRepository>;
  let auditService: jest.Mocked<AuditService>;

  const contexto = {
    usuarioId: 'psicologa-a',
    username: 'psicologa.a',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    acceso = {
      exigirAccesoExpediente: jest.fn(),
      exigirAccesoCita: jest.fn(),
      exigirReferidoPsicologia: jest.fn(),
    } as unknown as jest.Mocked<AccesoPsicologiaService>;
    atencionRepository = {
      buscarExpedienteConAcceso: jest.fn(),
      obtenerOCrear: jest.fn(),
      actualizarEstado: jest.fn(),
      existeReferidoPsicologia: jest.fn(),
      tomarCaso: jest.fn(),
      listarReferenciasSinTomar: jest.fn(),
      contarCasosActivos: jest.fn(),
      contarIniciadosEnRango: jest.fn(),
      contarCerradosEnRango: jest.fn(),
      listarProcesosSinProximaCita: jest.fn(),
      listarCerradosDesde: jest.fn(),
      buscarExpedientes: jest.fn(),
      obtenerResumenExpediente: jest.fn(),
    };
    auditService = {
      registrar: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    service = new ProcesoPsicologicoService(
      acceso,
      atencionRepository,
      auditService,
    );
  });

  describe('obtenerAtencion', () => {
    it('propaga el 403 del guard sin llegar al repositorio de atención', async () => {
      acceso.exigirAccesoExpediente.mockRejectedValue(
        new ForbiddenException('No tiene acceso a este expediente'),
      );

      await expect(
        service.obtenerAtencion('exp-ajeno', contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(atencionRepository.obtenerOCrear).not.toHaveBeenCalled();
    });

    it('pasa el usuarioId autenticado al guard, no solo el expedienteId', async () => {
      atencionRepository.obtenerOCrear.mockResolvedValue(crearAtencion());

      await service.obtenerAtencion('exp-1', contexto);

      expect(acceso.exigirAccesoExpediente).toHaveBeenCalledWith(
        'exp-1',
        'psicologa-a',
      );
    });

    it('audita la consulta como ATENCION_PSICOLOGICA_CONSULTADA', async () => {
      atencionRepository.obtenerOCrear.mockResolvedValue(crearAtencion());

      await service.obtenerAtencion('exp-1', contexto);

      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'ATENCION_PSICOLOGICA_CONSULTADA' }),
      );
    });
  });

  describe('actualizarEstadoAtencion', () => {
    it('propaga el 403 del guard antes de leer el estado actual', async () => {
      acceso.exigirAccesoExpediente.mockRejectedValue(
        new ForbiddenException('No tiene acceso a este expediente'),
      );

      await expect(
        service.actualizarEstadoAtencion(
          'exp-ajeno',
          { estado: 'SEGUIMIENTO', motivo: '' },
          contexto,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(atencionRepository.actualizarEstado).not.toHaveBeenCalled();
    });

    it('rechaza una transición al mismo estado en el que ya está (no-op)', async () => {
      atencionRepository.obtenerOCrear.mockResolvedValue(
        crearAtencion({ estado: 'SEGUIMIENTO' }),
      );

      await expect(
        service.actualizarEstadoAtencion(
          'exp-1',
          { estado: 'SEGUIMIENTO', motivo: '' },
          contexto,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(atencionRepository.actualizarEstado).not.toHaveBeenCalled();
    });

    it('convierte "" en null antes de pasar el motivo al repositorio', async () => {
      atencionRepository.obtenerOCrear.mockResolvedValue(
        crearAtencion({ estado: 'INICIO' }),
      );
      atencionRepository.actualizarEstado.mockResolvedValue(
        crearAtencion({ estado: 'SEGUIMIENTO' }),
      );

      await service.actualizarEstadoAtencion(
        'exp-1',
        { estado: 'SEGUIMIENTO', motivo: '' },
        contexto,
      );

      expect(atencionRepository.actualizarEstado).toHaveBeenCalledWith(
        expect.objectContaining({ motivo: null }),
      );
    });

    it('audita la transición con el estado nuevo, nunca con el motivo en detalles', async () => {
      atencionRepository.obtenerOCrear.mockResolvedValue(
        crearAtencion({ estado: 'SEGUIMIENTO' }),
      );
      atencionRepository.actualizarEstado.mockResolvedValue(
        crearAtencion({ estado: 'CIERRE' }),
      );

      await service.actualizarEstadoAtencion(
        'exp-1',
        { estado: 'CIERRE', motivo: 'motivo sensible de la usuaria' },
        contexto,
      );

      const llamada = auditService.registrar.mock.calls[0][0];
      expect(llamada.accion).toBe('ATENCION_PSICOLOGICA_ESTADO_ACTUALIZADO');
      expect(JSON.stringify(llamada.detalles ?? {})).not.toContain(
        'motivo sensible',
      );
    });
  });

  describe('tomarCaso', () => {
    it('rechaza con 403 si el expediente no está referido a PSICOLOGIA', async () => {
      acceso.exigirReferidoPsicologia.mockRejectedValue(
        new ForbiddenException('No tiene acceso a este expediente'),
      );

      await expect(
        service.tomarCaso('exp-ajeno', contexto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(atencionRepository.tomarCaso).not.toHaveBeenCalled();
    });

    it('rechaza con 409 genérico si el caso ya fue tomado por otra profesional, sin revelar quién', async () => {
      atencionRepository.tomarCaso.mockResolvedValue('YA_TOMADO');

      await expect(service.tomarCaso('exp-1', contexto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.tomarCaso('exp-1', contexto)).rejects.toThrow(
        'Este caso ya fue tomado por otra profesional',
      );
      expect(atencionRepository.obtenerOCrear).not.toHaveBeenCalled();
    });

    it('en éxito, reclama el caso y audita ATENCION_PSICOLOGICA_TOMADA', async () => {
      atencionRepository.tomarCaso.mockResolvedValue('TOMADO');
      atencionRepository.obtenerOCrear.mockResolvedValue(crearAtencion());

      const resultado = await service.tomarCaso('exp-1', contexto);

      expect(atencionRepository.tomarCaso).toHaveBeenCalledWith({
        expedienteId: 'exp-1',
        psicologaId: 'psicologa-a',
      });
      expect(resultado).toEqual(crearAtencion());
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'ATENCION_PSICOLOGICA_TOMADA',
          entidadId: 'atencion-1',
        }),
      );
    });
  });

  describe('listarReferenciasSinTomar', () => {
    it('delega directamente al repositorio, sin guard (visible a toda el área)', async () => {
      atencionRepository.listarReferenciasSinTomar.mockResolvedValue([]);

      await service.listarReferenciasSinTomar();

      expect(atencionRepository.listarReferenciasSinTomar).toHaveBeenCalled();
      expect(acceso.exigirAccesoExpediente).not.toHaveBeenCalled();
    });
  });

  describe('buscarExpedientes', () => {
    it('siempre acota la búsqueda a los expedientes tomados por la psicóloga autenticada', async () => {
      atencionRepository.buscarExpedientes.mockResolvedValue({
        items: [],
        siguienteCursor: null,
      });

      await service.buscarExpedientes(
        { q: 'garcia', cursor: undefined },
        'psicologa-a',
      );

      expect(atencionRepository.buscarExpedientes).toHaveBeenCalledWith(
        expect.objectContaining({ psicologaId: 'psicologa-a', q: 'garcia' }),
      );
    });

    it('no exige guard de acceso por expediente (es una búsqueda, no una lectura puntual)', async () => {
      atencionRepository.buscarExpedientes.mockResolvedValue({
        items: [],
        siguienteCursor: null,
      });

      await service.buscarExpedientes({}, 'psicologa-a');

      expect(acceso.exigirAccesoExpediente).not.toHaveBeenCalled();
    });
  });

  describe('obtenerResumenExpediente', () => {
    it('propaga el 403 del guard sin llegar al repositorio', async () => {
      acceso.exigirAccesoExpediente.mockRejectedValue(
        new ForbiddenException('No tiene acceso a este expediente'),
      );

      await expect(
        service.obtenerResumenExpediente('exp-ajeno', 'psicologa-a'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(
        atencionRepository.obtenerResumenExpediente,
      ).not.toHaveBeenCalled();
    });

    it('lanza 404 si el expediente desaparece entre el guard y la lectura', async () => {
      atencionRepository.obtenerResumenExpediente.mockResolvedValue(null);

      await expect(
        service.obtenerResumenExpediente('exp-1', 'psicologa-a'),
      ).rejects.toThrow('Expediente no encontrado');
    });

    it('en éxito, devuelve el resumen del repositorio', async () => {
      const resumen = {
        expedienteId: 'exp-1',
        numero: '2026-001',
        usuariaNombreCompleto: 'Usuaria Prueba',
        estado: 'SEGUIMIENTO' as const,
        psicologaAsignada: 'Psicóloga A',
        tomadaEn: '2026-09-01T12:00:00.000Z',
        fechaInicio: null,
        fechaCierre: null,
        motivoCierre: null,
        historialEstados: [],
        totalCitas: 3,
        proximaCita: null,
      };
      atencionRepository.obtenerResumenExpediente.mockResolvedValue(resumen);

      const resultado = await service.obtenerResumenExpediente(
        'exp-1',
        'psicologa-a',
      );

      expect(resultado).toEqual(resumen);
    });
  });
});
