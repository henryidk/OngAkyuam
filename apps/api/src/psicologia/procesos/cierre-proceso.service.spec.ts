/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { CerrarProcesoPsicologiaInput } from '@akyuam/shared';
import {
  contexto,
  crearAcceso,
  crearAuditService,
  crearBandejaRepository,
  crearProcesosRepository,
  eventosAuditados,
  EXPEDIENTE_ID,
  PROCESO_ID,
  procesoConAcceso,
} from '../pruebas/dobles';
import { CierreProcesoService } from './cierre-proceso.service';

const datos: CerrarProcesoPsicologiaInput = {
  motivo: 'OTRO',
  resumen: 'RESUMEN-CLINICO ficticio',
  version: 3,
};

describe('CierreProcesoService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: CierreProcesoService;

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    auditService = crearAuditService();
    service = new CierreProcesoService(
      procesosRepository,
      crearAcceso(crearBandejaRepository(), procesosRepository),
      auditService,
    );
  });

  it('cierra el proceso y devuelve la versión nueva y las citas canceladas', async () => {
    await expect(service.cerrar(PROCESO_ID, datos, contexto)).resolves.toEqual({
      id: PROCESO_ID,
      version: 4,
      citasCanceladas: 2,
    });
    expect(procesosRepository.cerrar).toHaveBeenCalledWith({
      procesoId: PROCESO_ID,
      version: 3,
      motivo: 'OTRO',
      resumen: 'RESUMEN-CLINICO ficticio',
      cerradoPorId: 'psicologa-a',
    });
  });

  it('guarda el resumen vacío como nulo', async () => {
    await service.cerrar(
      PROCESO_ID,
      { motivo: 'OBJETIVOS_CUMPLIDOS', resumen: '', version: 3 },
      contexto,
    );

    expect(procesosRepository.cerrar).toHaveBeenCalledWith(
      expect.objectContaining({ resumen: null }),
    );
  });

  it('audita motivo de catálogo y conteo, nunca el texto del resumen', async () => {
    await service.cerrar(PROCESO_ID, datos, contexto);

    const eventos = eventosAuditados(auditService);
    expect(eventos).toEqual([
      expect.objectContaining({
        accion: 'PROCESO_PSICOLOGICO_CERRADO',
        entidadId: PROCESO_ID,
        detalles: {
          expedienteId: EXPEDIENTE_ID,
          motivo: 'OTRO',
          citasCanceladas: 2,
        },
      }),
    ]);
    expect(JSON.stringify(eventos)).not.toContain('CLINICO');
  });

  it('poder leer el proceso cerrado de una colega no permite modificarlo', async () => {
    procesosRepository.buscarLecturaProceso.mockResolvedValue({
      id: PROCESO_ID,
      expedienteId: EXPEDIENTE_ID,
      propio: false,
    });
    procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

    await expect(
      service.cerrar(PROCESO_ID, datos, contexto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(procesosRepository.cerrar).not.toHaveBeenCalled();
  });

  it('rechaza con 403 el proceso de otra psicóloga o inexistente, sin cerrar', async () => {
    procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

    await expect(
      service.cerrar(PROCESO_ID, datos, contexto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(procesosRepository.buscarAccesoProceso).toHaveBeenCalledWith(
      PROCESO_ID,
      'psicologa-a',
    );
    expect(procesosRepository.cerrar).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('responde 409 si el proceso ya estaba cerrado', async () => {
    procesosRepository.buscarAccesoProceso.mockResolvedValue(
      procesoConAcceso({ etapa: 'CIERRE' }),
    );

    await expect(service.cerrar(PROCESO_ID, datos, contexto)).rejects.toEqual(
      new ConflictException('El proceso ya está cerrado'),
    );
    expect(procesosRepository.cerrar).not.toHaveBeenCalled();
  });

  it('responde 409 si la versión enviada ya no es la actual', async () => {
    await expect(
      service.cerrar(PROCESO_ID, { ...datos, version: 2 }, contexto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(procesosRepository.cerrar).not.toHaveBeenCalled();
  });

  it('responde 409 y no audita si otra pestaña lo cambió justo antes de guardar', async () => {
    procesosRepository.cerrar.mockResolvedValue(null);

    await expect(
      service.cerrar(PROCESO_ID, datos, contexto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditService.registrar).not.toHaveBeenCalled();
  });
});
