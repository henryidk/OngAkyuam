/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
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
import { ProcesosPsicologiaService } from './procesos.service';

const datos = { visibleJuridico: true, visibleMedica: false, version: 3 };

describe('ProcesosPsicologiaService.actualizarVisibilidad', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: ProcesosPsicologiaService;

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    auditService = crearAuditService();
    service = new ProcesosPsicologiaService(
      procesosRepository,
      crearAcceso(crearBandejaRepository(), procesosRepository),
      auditService,
    );
  });

  it('guarda qué áreas ven el proceso y devuelve la versión nueva', async () => {
    await expect(
      service.actualizarVisibilidad(PROCESO_ID, datos, contexto),
    ).resolves.toEqual({
      id: PROCESO_ID,
      version: 4,
      visibleJuridico: true,
      visibleMedica: false,
    });
    expect(procesosRepository.actualizarVisibilidad).toHaveBeenCalledWith({
      procesoId: PROCESO_ID,
      version: 3,
      visibleJuridico: true,
      visibleMedica: false,
      actualizadoPorId: 'psicologa-a',
    });
  });

  it('también se puede corregir con el proceso cerrado', async () => {
    procesosRepository.buscarAccesoProceso.mockResolvedValue(
      procesoConAcceso({ etapa: 'CIERRE' }),
    );

    await expect(
      service.actualizarVisibilidad(PROCESO_ID, datos, contexto),
    ).resolves.toMatchObject({ version: 4 });
  });

  it('audita el cambio', async () => {
    await service.actualizarVisibilidad(PROCESO_ID, datos, contexto);

    expect(eventosAuditados(auditService)).toEqual([
      expect.objectContaining({
        accion: 'PROCESO_PSICOLOGICO_VISIBILIDAD_ACTUALIZADA',
        entidadId: PROCESO_ID,
        detalles: {
          expedienteId: EXPEDIENTE_ID,
          visibleJuridico: true,
          visibleMedica: false,
        },
      }),
    ]);
  });

  it('poder leer el proceso cerrado de una colega no permite modificarlo', async () => {
    procesosRepository.buscarLecturaProceso.mockResolvedValue({
      id: PROCESO_ID,
      expedienteId: EXPEDIENTE_ID,
      propio: false,
    });
    procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

    await expect(
      service.actualizarVisibilidad(PROCESO_ID, datos, contexto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(procesosRepository.actualizarVisibilidad).not.toHaveBeenCalled();
  });

  it('rechaza con 403 el proceso de otra psicóloga, sin guardar', async () => {
    procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

    await expect(
      service.actualizarVisibilidad(PROCESO_ID, datos, contexto),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(procesosRepository.actualizarVisibilidad).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  });

  it('responde 409 y no audita si la versión ya no es la actual', async () => {
    procesosRepository.actualizarVisibilidad.mockResolvedValue(null);

    await expect(
      service.actualizarVisibilidad(PROCESO_ID, datos, contexto),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditService.registrar).not.toHaveBeenCalled();
  });
});
