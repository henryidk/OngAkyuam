/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AsignacionPersonalService } from '../compartido/asignacion-personal.service';
import {
  MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE,
  MENSAJE_AUDIENCIA_DEMASIADO_LEJOS,
  MENSAJE_AUDIENCIA_NO_ES_FUTURO,
  MENSAJE_CONFLICTO_VERSION_AUDIENCIA,
  MENSAJE_HORA_OCUPADA,
  MENSAJE_PROCESO_CERRADO_AUDIENCIA,
  MENSAJE_SIN_ACCESO_AUDIENCIA,
  MENSAJE_SIN_ACCESO_PROCESO,
} from '../compartido/mensajes';
import {
  ABOGADA_ID,
  AUDIENCIA_ID,
  OTRA_ABOGADA_ID,
  PROCESO_ID,
  accionesAuditadas,
  audienciaParaEscritura,
  contexto,
  crearAcceso,
  crearAudienciasRepository,
  crearAuditService,
  crearPersonalRepository,
  crearProcesosRepository,
  escrituraOk,
  procesoConAcceso,
  relojFijo,
} from '../pruebas/dobles';
import { ProgramacionAudienciasService } from './programacion-audiencias.service';

const NUEVA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTRO_PROCESO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('ProgramacionAudienciasService', () => {
  let procesosRepository: ReturnType<typeof crearProcesosRepository>;
  let audiencias: ReturnType<typeof crearAudienciasRepository>;
  let personal: ReturnType<typeof crearPersonalRepository>;
  let auditService: ReturnType<typeof crearAuditService>;
  let service: ProgramacionAudienciasService;

  beforeEach(() => {
    procesosRepository = crearProcesosRepository();
    audiencias = crearAudienciasRepository();
    personal = crearPersonalRepository();
    auditService = crearAuditService();
    service = new ProgramacionAudienciasService(
      audiencias,
      crearAcceso(procesosRepository),
      new AsignacionPersonalService(personal),
      relojFijo(),
      auditService,
    );
  });

  const agenda = (parcial = {}) => ({
    fechaHora: '2026-10-22T10:00',
    responsableId: ABOGADA_ID,
    descripcion: '',
    numeroJudicial: null,
    reprogramadaDesdeId: null,
    ...parcial,
  });

  function sinEscrituras() {
    expect(audiencias.agendar).not.toHaveBeenCalled();
    expect(audiencias.reprogramar).not.toHaveBeenCalled();
    expect(audiencias.cancelar).not.toHaveBeenCalled();
    expect(audiencias.cambiarResponsable).not.toHaveBeenCalled();
    expect(auditService.registrar).not.toHaveBeenCalled();
  }

  describe('agendar', () => {
    it('403 uniforme si el proceso no es de Jurídico, sin escribir', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(null);

      await expect(
        service.agendar(PROCESO_ID, agenda(), contexto),
      ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_PROCESO));
      sinEscrituras();
    });

    it.each([
      ['finalizado', { fase: 'FINALIZADO' as const }],
      ['abandonado', { situacion: 'ABANDONADO' as const }],
    ])('409 si el proceso está %s', async (_caso, parcial) => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(
        procesoConAcceso(parcial),
      );

      await expect(
        service.agendar(PROCESO_ID, agenda(), contexto),
      ).rejects.toThrow(
        new ConflictException(MENSAJE_PROCESO_CERRADO_AUDIENCIA),
      );
      sinEscrituras();
    });

    it('acepta un proceso suspendido: sigue vivo', async () => {
      procesosRepository.buscarAccesoProceso.mockResolvedValue(
        procesoConAcceso({ situacion: 'SUSPENDIDO' }),
      );

      await service.agendar(PROCESO_ID, agenda(), contexto);

      expect(audiencias.agendar).toHaveBeenCalled();
    });

    it.each([
      ['la hora actual', '2026-10-19T09:00', MENSAJE_AUDIENCIA_NO_ES_FUTURO],
      ['el pasado', '2026-10-18T10:00', MENSAJE_AUDIENCIA_NO_ES_FUTURO],
      ['más de 3 años', '2029-10-20T10:00', MENSAJE_AUDIENCIA_DEMASIADO_LEJOS],
    ])('400 si la fecha es %s', async (_caso, fechaHora, mensaje) => {
      await expect(
        service.agendar(PROCESO_ID, agenda({ fechaHora }), contexto),
      ).rejects.toThrow(new BadRequestException(mensaje));
      sinEscrituras();
    });

    it('400 si la responsable no es una abogada activa', async () => {
      await expect(
        service.agendar(
          PROCESO_ID,
          agenda({ responsableId: NUEVA_ID }),
          contexto,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(personal.buscarActivo).toHaveBeenCalledWith({
        id: NUEVA_ID,
        area: 'JURIDICO',
        tipo: 'ABOGADA',
      });
      sinEscrituras();
    });

    it('guarda en hora de Guatemala, deja la bitácora y audita sin datos de la usuaria', async () => {
      const resultado = await service.agendar(
        PROCESO_ID,
        agenda({ descripcion: 'Conciliación' }),
        contexto,
      );

      expect(audiencias.agendar).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        usuarioId: contexto.usuarioId,
        inicio: new Date('2026-10-22T16:00:00.000Z'),
        responsableId: ABOGADA_ID,
        descripcion: 'Conciliación',
        reprogramadaDesdeId: null,
        numeroJudicial: null,
        textoBitacora:
          'Audiencia agendada para 22/10/2026 10:00 · Abogada Ficticia',
      });
      expect(resultado).toEqual({
        id: AUDIENCIA_ID,
        fecha: '2026-10-22',
        hora: '10:00',
      });
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'AUDIENCIA_AGENDADA',
          entidad: 'AudienciaJuridica',
          entidadId: AUDIENCIA_ID,
          detalles: { procesoId: PROCESO_ID },
        }),
      );
      expect(accionesAuditadas(auditService)).toEqual(['AUDIENCIA_AGENDADA']);
    });

    it('descripción vacía se guarda como null', async () => {
      await service.agendar(PROCESO_ID, agenda(), contexto);

      expect(audiencias.agendar).toHaveBeenCalledWith(
        expect.objectContaining({ descripcion: null }),
      );
    });

    it('audita el No. judicial solo si se asignó, sin el número en detalles', async () => {
      audiencias.agendar.mockResolvedValue(
        escrituraOk({ numeroJudicialAsignado: true }),
      );

      await service.agendar(
        PROCESO_ID,
        agenda({ numeroJudicial: 'C-01-2026' }),
        contexto,
      );

      expect(accionesAuditadas(auditService)).toEqual([
        'AUDIENCIA_AGENDADA',
        'PROCESO_NUMERO_JUDICIAL',
      ]);
      expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
        'C-01-2026',
      );
    });

    it('409 si la base rechaza por hora ocupada, sin auditar', async () => {
      audiencias.agendar.mockResolvedValue({
        ok: false,
        fallo: 'HORA_OCUPADA',
      });

      await expect(
        service.agendar(PROCESO_ID, agenda(), contexto),
      ).rejects.toThrow(new ConflictException(MENSAJE_HORA_OCUPADA));
      expect(auditService.registrar).not.toHaveBeenCalled();
    });

    describe('nueva fecha de una cancelada o no realizada', () => {
      it('se enlaza a la anterior y lo audita', async () => {
        audiencias.buscarParaEscritura.mockResolvedValue(
          audienciaParaEscritura({ estado: 'CANCELADA' }),
        );

        await service.agendar(
          PROCESO_ID,
          agenda({ reprogramadaDesdeId: AUDIENCIA_ID }),
          contexto,
        );

        expect(audiencias.agendar).toHaveBeenCalledWith(
          expect.objectContaining({ reprogramadaDesdeId: AUDIENCIA_ID }),
        );
        expect(auditService.registrar).toHaveBeenCalledWith(
          expect.objectContaining({
            detalles: {
              procesoId: PROCESO_ID,
              reprogramadaDesdeId: AUDIENCIA_ID,
            },
          }),
        );
      });

      it('403 si la anterior no existe o no es de Jurídico', async () => {
        audiencias.buscarParaEscritura.mockResolvedValue(null);

        await expect(
          service.agendar(
            PROCESO_ID,
            agenda({ reprogramadaDesdeId: AUDIENCIA_ID }),
            contexto,
          ),
        ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_AUDIENCIA));
        sinEscrituras();
      });

      it('403 si la anterior es de otro proceso', async () => {
        audiencias.buscarParaEscritura.mockResolvedValue(
          audienciaParaEscritura({
            estado: 'CANCELADA',
            procesoId: OTRO_PROCESO_ID,
          }),
        );

        await expect(
          service.agendar(
            PROCESO_ID,
            agenda({ reprogramadaDesdeId: AUDIENCIA_ID }),
            contexto,
          ),
        ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_AUDIENCIA));
        sinEscrituras();
      });

      it.each([
        ['sigue programada', { estado: 'PROGRAMADA' as const }],
        ['fue realizada', { estado: 'REALIZADA' as const }],
        [
          'ya tiene nueva fecha',
          { estado: 'NO_REALIZADA' as const, tieneNuevaFecha: true },
        ],
      ])('409 si la anterior %s', async (_caso, parcial) => {
        audiencias.buscarParaEscritura.mockResolvedValue(
          audienciaParaEscritura(parcial),
        );

        await expect(
          service.agendar(
            PROCESO_ID,
            agenda({ reprogramadaDesdeId: AUDIENCIA_ID }),
            contexto,
          ),
        ).rejects.toThrow(
          new ConflictException(MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE),
        );
        sinEscrituras();
      });
    });
  });

  describe('reprogramar', () => {
    const reprogramacion = (parcial = {}) => ({
      fechaHora: '2026-10-28T11:00',
      responsableId: ABOGADA_ID,
      motivo: 'El juzgado cambió la fecha',
      version: 2,
      ...parcial,
    });

    it('403 si la audiencia no existe o no es de Jurídico', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(null);

      await expect(
        service.reprogramar(AUDIENCIA_ID, reprogramacion(), contexto),
      ).rejects.toThrow(new ForbiddenException(MENSAJE_SIN_ACCESO_AUDIENCIA));
      sinEscrituras();
    });

    it('409 si el proceso ya se cerró', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(
        audienciaParaEscritura({ procesoAbierto: false }),
      );

      await expect(
        service.reprogramar(AUDIENCIA_ID, reprogramacion(), contexto),
      ).rejects.toThrow(
        new ConflictException(MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE),
      );
      sinEscrituras();
    });

    it('mantiene a la misma responsable aunque ya no esté activa', async () => {
      personal = crearPersonalRepository([]);
      service = new ProgramacionAudienciasService(
        audiencias,
        crearAcceso(procesosRepository),
        new AsignacionPersonalService(personal),
        relojFijo(),
        auditService,
      );
      audiencias.reprogramar.mockResolvedValue(
        escrituraOk({ audienciaId: NUEVA_ID }),
      );

      const resultado = await service.reprogramar(
        AUDIENCIA_ID,
        reprogramacion(),
        contexto,
      );

      expect(personal.buscarActivo).not.toHaveBeenCalled();
      expect(audiencias.reprogramar).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        audienciaId: AUDIENCIA_ID,
        version: 2,
        usuarioId: contexto.usuarioId,
        inicio: new Date('2026-10-28T17:00:00.000Z'),
        responsableId: ABOGADA_ID,
        motivo: 'El juzgado cambió la fecha',
        textoBitacora:
          'Audiencia del 21/10/2026 09:30 reprogramada para 28/10/2026 11:00 · Abogada Ficticia',
      });
      expect(resultado).toEqual({
        id: NUEVA_ID,
        fecha: '2026-10-28',
        hora: '11:00',
      });
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'AUDIENCIA_REPROGRAMADA',
          entidadId: AUDIENCIA_ID,
          detalles: { procesoId: PROCESO_ID, nuevaAudienciaId: NUEVA_ID },
        }),
      );
    });

    it('una responsable distinta debe ser abogada activa', async () => {
      await service.reprogramar(
        AUDIENCIA_ID,
        reprogramacion({ responsableId: OTRA_ABOGADA_ID }),
        contexto,
      );

      expect(personal.buscarActivo).toHaveBeenCalledWith(
        expect.objectContaining({ id: OTRA_ABOGADA_ID }),
      );
      expect(audiencias.reprogramar).toHaveBeenCalledWith(
        expect.objectContaining({ responsableId: OTRA_ABOGADA_ID }),
      );
    });

    it('400 si la nueva fecha ya pasó', async () => {
      await expect(
        service.reprogramar(
          AUDIENCIA_ID,
          reprogramacion({ fechaHora: '2026-10-19T08:00' }),
          contexto,
        ),
      ).rejects.toThrow(
        new BadRequestException(MENSAJE_AUDIENCIA_NO_ES_FUTURO),
      );
      sinEscrituras();
    });

    it('409 con versión desactualizada, sin auditar', async () => {
      audiencias.reprogramar.mockResolvedValue({
        ok: false,
        fallo: 'VERSION_DESACTUALIZADA',
      });

      await expect(
        service.reprogramar(AUDIENCIA_ID, reprogramacion(), contexto),
      ).rejects.toThrow(
        new ConflictException(MENSAJE_CONFLICTO_VERSION_AUDIENCIA),
      );
      expect(auditService.registrar).not.toHaveBeenCalled();
    });
  });

  describe('cancelar', () => {
    const cancelacion = { motivo: 'Lo pidió la usuaria', version: 2 };

    it('cancela a mano y audita sin el motivo', async () => {
      await service.cancelar(AUDIENCIA_ID, cancelacion, contexto);

      expect(audiencias.cancelar).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        audienciaId: AUDIENCIA_ID,
        version: 2,
        usuarioId: contexto.usuarioId,
        motivo: 'Lo pidió la usuaria',
        textoBitacora: 'Audiencia del 21/10/2026 09:30 cancelada',
      });
      expect(auditService.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          accion: 'AUDIENCIA_CANCELADA',
          detalles: { procesoId: PROCESO_ID, origen: 'MANUAL' },
        }),
      );
      expect(JSON.stringify(auditService.registrar.mock.calls)).not.toContain(
        'usuaria',
      );
    });

    it('se puede cancelar aunque el proceso ya esté cerrado', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(
        audienciaParaEscritura({ procesoAbierto: false }),
      );

      await service.cancelar(AUDIENCIA_ID, cancelacion, contexto);

      expect(audiencias.cancelar).toHaveBeenCalled();
    });

    it.each(['REALIZADA', 'CANCELADA', 'REPROGRAMADA'] as const)(
      '409 si ya está %s',
      async (estado) => {
        audiencias.buscarParaEscritura.mockResolvedValue(
          audienciaParaEscritura({ estado }),
        );

        await expect(
          service.cancelar(AUDIENCIA_ID, cancelacion, contexto),
        ).rejects.toThrow(
          new ConflictException(MENSAJE_ACCION_AUDIENCIA_NO_DISPONIBLE),
        );
        sinEscrituras();
      },
    );

    it('403 si la audiencia no es de Jurídico', async () => {
      audiencias.buscarParaEscritura.mockResolvedValue(null);

      await expect(
        service.cancelar(AUDIENCIA_ID, cancelacion, contexto),
      ).rejects.toThrow(ForbiddenException);
      sinEscrituras();
    });
  });

  describe('cambiarResponsable', () => {
    it('no hace nada si es la misma responsable', async () => {
      await service.cambiarResponsable(
        AUDIENCIA_ID,
        { responsableId: ABOGADA_ID, version: 2 },
        contexto,
      );

      sinEscrituras();
    });

    it('cambia a otra abogada activa y lo deja en la bitácora', async () => {
      await service.cambiarResponsable(
        AUDIENCIA_ID,
        { responsableId: OTRA_ABOGADA_ID, version: 2 },
        contexto,
      );

      expect(audiencias.cambiarResponsable).toHaveBeenCalledWith({
        procesoId: PROCESO_ID,
        audienciaId: AUDIENCIA_ID,
        version: 2,
        usuarioId: contexto.usuarioId,
        responsableId: OTRA_ABOGADA_ID,
        textoBitacora:
          'Audiencia del 21/10/2026 09:30: nueva responsable Otra Abogada Ficticia',
      });
      expect(accionesAuditadas(auditService)).toEqual([
        'AUDIENCIA_RESPONSABLE',
      ]);
    });

    it('400 si la nueva responsable no está activa', async () => {
      await expect(
        service.cambiarResponsable(
          AUDIENCIA_ID,
          { responsableId: NUEVA_ID, version: 2 },
          contexto,
        ),
      ).rejects.toThrow(BadRequestException);
      sinEscrituras();
    });
  });
});
