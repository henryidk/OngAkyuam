import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  VisibilidadProcesoPsicologiaDto,
  VisibilidadProcesoPsicologiaInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import { MENSAJE_CONFLICTO_VERSION } from '../compartido/mensajes';
import { PROCESOS_PSICOLOGIA_REPOSITORY } from '../interfaces/procesos-psicologia-repository.interface';
import type { IProcesosPsicologiaRepository } from '../interfaces/procesos-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

@Injectable()
export class ProcesosPsicologiaService {
  constructor(
    @Inject(PROCESOS_PSICOLOGIA_REPOSITORY)
    private readonly procesosRepository: IProcesosPsicologiaRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Qué otras áreas ven etapa, fechas y documentos del proceso. Se puede corregir también con
   * el proceso cerrado. Trabajo Social no figura: siempre los ve; las notas, nunca nadie.
   */
  async actualizarVisibilidad(
    procesoId: string,
    datos: VisibilidadProcesoPsicologiaInput,
    contexto: ContextoAuditoria,
  ): Promise<VisibilidadProcesoPsicologiaDto> {
    const proceso = await this.acceso.exigirAccesoProceso(
      procesoId,
      contexto.usuarioId,
    );

    const version = await this.procesosRepository.actualizarVisibilidad({
      procesoId,
      version: datos.version,
      visibleJuridico: datos.visibleJuridico,
      visibleMedica: datos.visibleMedica,
      actualizadoPorId: contexto.usuarioId,
    });
    if (version === null) {
      throw new ConflictException(MENSAJE_CONFLICTO_VERSION);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_PSICOLOGICO_VISIBILIDAD_ACTUALIZADA',
        entidad: 'AtencionPsicologica',
        entidadId: procesoId,
        detalles: {
          expedienteId: proceso.expedienteId,
          visibleJuridico: datos.visibleJuridico,
          visibleMedica: datos.visibleMedica,
        },
      }),
    );

    return {
      id: procesoId,
      version,
      visibleJuridico: datos.visibleJuridico,
      visibleMedica: datos.visibleMedica,
    };
  }
}
