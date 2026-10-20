/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  asignarNumeroJudicialSchema,
  type ErrorNumeroJudicialRepetido,
} from '@akyuam/shared';
import { MENSAJE_CONFLICTO_VERSION } from '../compartido/mensajes';
import {
  TEXTO_NUMERO_JUDICIAL_CORREGIDO,
  TEXTO_NUMERO_JUDICIAL_REGISTRADO,
} from '../compartido/textos-bitacora';
import type { INumeroJudicialRepository } from '../interfaces/numero-judicial-repository.interface';
import {
  EXPEDIENTE_ID,
  PROCESO_ID,
  contexto,
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
  procesoConAcceso,
} from '../pruebas/dobles';
import { NumeroJudicialService } from './numero-judicial.service';

const VERSION = 3;
const OTRO_PROCESO = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  codigo: '03-2026',
  tipo: 'FIJACION_PENSION_ALIMENTICIA' as const,
};

function datos(parcial: Record<string, unknown> = {}) {
  return asignarNumeroJudicialSchema.parse({
    numeroJudicial: 'C-01-2026-123',
    version: VERSION,
    ...parcial,
  });
}

describe('NumeroJudicialService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let repositorio: jest.Mocked<INumeroJudicialRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: NumeroJudicialService;

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    repositorio = {
      buscarProcesosConNumero: jest.fn().mockResolvedValue([]),
      asignar: jest.fn().mockResolvedValue(true),
    };
    auditService = crearAuditService();
    service = new NumeroJudicialService(
      repositorio,
      crearAcceso(procesosRepository),
      auditService,
    );
  });

  function conNumeroActual(numeroJudicial: string | null) {
    procesosRepository.buscarAccesoProceso.mockResolvedValue(
      procesoConAcceso({ numeroJudicial }),
    );
  }

  it('403 uniforme si no hay acceso al proceso, sin buscar ni escribir', async () => {
    procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

    await expect(
      service.asignar(PROCESO_ID, datos(), contexto),
    ).rejects.toThrow(ForbiddenException);
    expect(repositorio.buscarProcesosConNumero).not.toHaveBeenCalled();
    expect(repositorio.asignar).not.toHaveBeenCalled();
  });

  it('409 si la versión enviada ya no es la actual', async () => {
    await expect(
      service.asignar(PROCESO_ID, datos({ version: VERSION - 1 }), contexto),
    ).rejects.toThrow(new ConflictException(MENSAJE_CONFLICTO_VERSION));
    expect(repositorio.asignar).not.toHaveBeenCalled();
  });

  it('registra un número nuevo, anota "registró" y audita sin el número', async () => {
    await service.asignar(PROCESO_ID, datos(), contexto);

    expect(repositorio.buscarProcesosConNumero).toHaveBeenCalledWith(
      'C-01-2026-123',
      PROCESO_ID,
    );
    expect(repositorio.asignar).toHaveBeenCalledWith({
      procesoId: PROCESO_ID,
      version: VERSION,
      numeroJudicial: 'C-01-2026-123',
      usuarioId: contexto.usuarioId,
      textoBitacora: TEXTO_NUMERO_JUDICIAL_REGISTRADO,
    });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'PROCESO_NUMERO_JUDICIAL',
        entidadId: PROCESO_ID,
        detalles: {
          expedienteId: EXPEDIENTE_ID,
          corregido: false,
          repetidoConfirmado: false,
        },
      }),
    );
    expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
      'C-01-2026-123',
    );
  });

  it('normaliza espacios antes de guardar', async () => {
    await service.asignar(
      PROCESO_ID,
      datos({ numeroJudicial: '  C-01   2026 ' }),
      contexto,
    );

    expect(repositorio.asignar).toHaveBeenCalledWith(
      expect.objectContaining({ numeroJudicial: 'C-01 2026' }),
    );
  });

  it('si ya tenía otro número, anota "corrigió"', async () => {
    conNumeroActual('C-01-2026-999');

    await service.asignar(PROCESO_ID, datos(), contexto);

    expect(repositorio.asignar).toHaveBeenCalledWith(
      expect.objectContaining({
        textoBitacora: TEXTO_NUMERO_JUDICIAL_CORREGIDO,
      }),
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        detalles: expect.objectContaining({ corregido: true }) as unknown,
      }),
    );
  });

  it('el mismo número que ya tenía no escribe, no anota ni audita', async () => {
    conNumeroActual('C-01-2026-123');

    await service.asignar(PROCESO_ID, datos(), contexto);

    expect(repositorio.buscarProcesosConNumero).not.toHaveBeenCalled();
    expect(repositorio.asignar).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('repetido en otro proceso: 409 con el código y los procesos, sin guardar', async () => {
    repositorio.buscarProcesosConNumero.mockResolvedValue([OTRO_PROCESO]);

    const error = await service
      .asignar(PROCESO_ID, datos(), contexto)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual({
      codigo: 'NUMERO_JUDICIAL_REPETIDO',
      message:
        'Ya está en el expediente 03-2026 · Juicio Oral de Fijación de Pensión Alimenticia',
      detalle: { procesos: [OTRO_PROCESO] },
    } satisfies ErrorNumeroJudicialRepetido);
    expect(repositorio.asignar).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('repetido y confirmado: guarda sin volver a buscar y lo deja en la auditoría', async () => {
    repositorio.buscarProcesosConNumero.mockResolvedValue([OTRO_PROCESO]);

    await service.asignar(
      PROCESO_ID,
      datos({ confirmarNumeroRepetido: true }),
      contexto,
    );

    expect(repositorio.buscarProcesosConNumero).not.toHaveBeenCalled();
    expect(repositorio.asignar).toHaveBeenCalled();
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        detalles: expect.objectContaining({
          repetidoConfirmado: true,
        }) as unknown,
      }),
    );
  });

  it('409 si otra persona cambió el proceso entre la lectura y la escritura', async () => {
    repositorio.asignar.mockResolvedValue(false);

    await expect(
      service.asignar(PROCESO_ID, datos(), contexto),
    ).rejects.toThrow(new ConflictException(MENSAJE_CONFLICTO_VERSION));
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('rechaza un número vacío o de solo espacios', () => {
    expect(() => datos({ numeroJudicial: '   ' })).toThrow();
  });
});
