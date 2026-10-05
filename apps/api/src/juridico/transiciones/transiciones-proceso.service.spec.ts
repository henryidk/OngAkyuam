/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { hoyGT } from '@akyuam/shared';
import {
  MENSAJE_ACCION_NO_DISPONIBLE,
  MENSAJE_CONFLICTO_VERSION,
  MENSAJE_SIN_ACCESO_PROCESO,
} from '../compartido/mensajes';
import type { ITransicionesRepository } from '../interfaces/transiciones-repository.interface';
import {
  EXPEDIENTE_ID,
  PROCESO_ID,
  accionesAuditadas,
  contexto,
  crearAcceso,
  crearAuditService,
  crearProcesosRepository,
  procesoConAcceso,
} from '../pruebas/dobles';
import { TransicionesProcesoService } from './transiciones-proceso.service';

const VERSION = 3;

describe('TransicionesProcesoService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let transiciones: jest.Mocked<ITransicionesRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: TransicionesProcesoService;

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    transiciones = {
      finalizar: jest.fn().mockResolvedValue(true),
      suspender: jest.fn().mockResolvedValue(true),
      abandonar: jest.fn().mockResolvedValue(true),
      reactivar: jest.fn().mockResolvedValue(true),
    };
    auditService = crearAuditService();
    service = new TransicionesProcesoService(
      transiciones,
      crearAcceso(procesosRepository),
      auditService,
    );
  });

  function conProceso(parcial: Parameters<typeof procesoConAcceso>[0]) {
    procesosRepository.buscarAccesoProceso.mockResolvedValue(
      procesoConAcceso(parcial),
    );
  }

  const finalizacion = (parcial = {}) => ({
    forma: 'SENTENCIA' as const,
    detalle: '',
    fechaCierre: '2026-02-01',
    version: VERSION,
    ...parcial,
  });

  const abandono = (parcial = {}) => ({
    motivoCatalogo: 'OTRO' as const,
    observaciones: '',
    ultimoContacto: '' as const,
    intentos: 2,
    notificarTs: false,
    version: VERSION,
    ...parcial,
  });

  const suspension = (version = VERSION) => ({ motivo: 'Motivo', version });

  it('403 uniforme si el proceso no existe o no es de Jurídico, sin escribir', async () => {
    procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

    await expect(
      service.suspender(PROCESO_ID, suspension(), contexto),
    ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO));
    expect(transiciones.suspender).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('suspende un proceso en trámite y audita solo con ids', async () => {
    await service.suspender(PROCESO_ID, suspension(), contexto);

    expect(transiciones.suspender).toHaveBeenCalledWith({
      procesoId: PROCESO_ID,
      version: VERSION,
      usuarioId: contexto.usuarioId,
      motivo: 'Motivo',
    });
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'PROCESO_JURIDICO_SUSPENDIDO',
        entidad: 'ProcesoJuridico',
        entidadId: PROCESO_ID,
        detalles: { expedienteId: EXPEDIENTE_ID },
      }),
    );
  });

  it('409 si la versión enviada ya no es la actual', async () => {
    await expect(
      service.suspender(PROCESO_ID, suspension(VERSION - 1), contexto),
    ).rejects.toThrow(new ConflictException(MENSAJE_CONFLICTO_VERSION));
    expect(transiciones.suspender).not.toHaveBeenCalled();
  });

  it('409 si otra persona cambió el proceso entre la lectura y la escritura', async () => {
    transiciones.suspender.mockResolvedValue(false);

    await expect(
      service.suspender(PROCESO_ID, suspension(), contexto),
    ).rejects.toThrow(new ConflictException(MENSAJE_CONFLICTO_VERSION));
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it.each([
    [
      'finalizar un proceso suspendido',
      { situacion: 'SUSPENDIDO' },
      'finalizar',
    ],
    ['finalizar un proceso ya finalizado', { fase: 'FINALIZADO' }, 'finalizar'],
    [
      'suspender un proceso abandonado',
      { situacion: 'ABANDONADO' },
      'suspender',
    ],
    ['abandonar un proceso finalizado', { fase: 'FINALIZADO' }, 'abandonar'],
    ['reactivar un proceso activo', {}, 'reactivar'],
  ] as const)('409 al %s', async (_nombre, estado, accion) => {
    conProceso(estado);
    const llamadas = {
      finalizar: () => service.finalizar(PROCESO_ID, finalizacion(), contexto),
      suspender: () => service.suspender(PROCESO_ID, suspension(), contexto),
      abandonar: () => service.abandonar(PROCESO_ID, abandono(), contexto),
      reactivar: () =>
        service.reactivar(PROCESO_ID, { version: VERSION }, contexto),
    };

    await expect(llamadas[accion]()).rejects.toThrow(
      new ConflictException(MENSAJE_ACCION_NO_DISPONIBLE),
    );
    expect(transiciones[accion]).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('finaliza con forma y fecha, y audita la forma (nunca el detalle)', async () => {
    await service.finalizar(
      PROCESO_ID,
      finalizacion({ forma: 'OTROS', detalle: 'Texto libre' }),
      contexto,
    );

    expect(transiciones.finalizar).toHaveBeenCalledWith(
      expect.objectContaining({
        forma: 'OTROS',
        detalle: 'Texto libre',
        fechaCierre: '2026-02-01',
      }),
    );
    expect(auditService.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'PROCESO_JURIDICO_FINALIZADO',
        detalles: { expedienteId: EXPEDIENTE_ID, forma: 'OTROS' },
      }),
    );
  });

  it('400 si la fecha de cierre es anterior al inicio del proceso', async () => {
    await expect(
      service.finalizar(
        PROCESO_ID,
        finalizacion({ fechaCierre: '2026-01-09' }),
        contexto,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(transiciones.finalizar).not.toHaveBeenCalled();
  });

  it('400 si la fecha de cierre es futura', async () => {
    await expect(
      service.finalizar(
        PROCESO_ID,
        finalizacion({ fechaCierre: '2999-01-01' }),
        contexto,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('abandono: usa la fecha de hoy en Guatemala y la situación de la que sale', async () => {
    conProceso({ situacion: 'SUSPENDIDO' });

    await service.abandonar(PROCESO_ID, abandono(), contexto);

    expect(transiciones.abandonar).toHaveBeenCalledWith(
      expect.objectContaining({
        fecha: hoyGT(),
        situacionActual: 'SUSPENDIDO',
        ultimoContacto: null,
        observaciones: null,
        intentosContacto: 2,
        notificadoATs: false,
      }),
    );
    expect(accionesAuditadas(auditService)).toEqual([
      'PROCESO_JURIDICO_ABANDONADO',
    ]);
  });

  it('abandono con aviso: deja además el evento que ve Trabajo Social', async () => {
    await service.abandonar(
      PROCESO_ID,
      abandono({ notificarTs: true, observaciones: 'Texto libre' }),
      contexto,
    );

    expect(accionesAuditadas(auditService)).toEqual([
      'PROCESO_JURIDICO_ABANDONADO',
      'ABANDONO_REGISTRADO',
    ]);
    expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
      'Texto libre',
    );
  });

  it('reactiva un proceso abandonado indicando de qué situación sale', async () => {
    conProceso({ situacion: 'ABANDONADO' });

    await service.reactivar(PROCESO_ID, { version: VERSION }, contexto);

    expect(transiciones.reactivar).toHaveBeenCalledWith(
      expect.objectContaining({
        situacionActual: 'ABANDONADO',
        faseActual: 'EN_PROCESO',
      }),
    );
  });

  it('un proceso viejo abandonado en INICIADO se puede reactivar (vuelve como En proceso)', async () => {
    conProceso({ fase: 'INICIADO', situacion: 'ABANDONADO' });

    await service.reactivar(PROCESO_ID, { version: VERSION }, contexto);

    expect(transiciones.reactivar).toHaveBeenCalledWith(
      expect.objectContaining({ faseActual: 'INICIADO' }),
    );
  });
});
