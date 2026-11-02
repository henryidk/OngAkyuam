import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccionTrabajoSocialDto,
  RegistrarAccionTrabajoSocialInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { ACCIONES_REPOSITORY } from './interfaces/acciones-repository.interface';
import type { IAccionesRepository } from './interfaces/acciones-repository.interface';

/**
 * Bitácora de la atención que Trabajo Social brinda en un caso (visitas, gestiones,
 * acompañamientos...). Sale resumida en la columna "Atención brindada" del reporte de población.
 * La auditoría guarda solo el id del caso y de la acción, nunca la descripción.
 */
@Injectable()
export class AccionesService {
  constructor(
    @Inject(ACCIONES_REPOSITORY)
    private readonly accionesRepository: IAccionesRepository,
    private readonly auditService: AuditService,
  ) {}

  async listar(
    expedienteId: string,
    contexto: ContextoAuditoria,
  ): Promise<AccionTrabajoSocialDto[]> {
    await this.exigirExpediente(expedienteId);
    const acciones = await this.accionesRepository.listar(expedienteId);
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ACCIONES_TS_CONSULTADAS',
      entidad: 'Expediente',
      entidadId: expedienteId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });
    return acciones;
  }

  async registrar(
    expedienteId: string,
    datos: RegistrarAccionTrabajoSocialInput,
    contexto: ContextoAuditoria,
  ): Promise<AccionTrabajoSocialDto> {
    await this.exigirExpediente(expedienteId);
    const accion = await this.accionesRepository.registrar({
      expedienteId,
      fecha: datos.fecha,
      descripcion: datos.descripcion,
      registradaPorId: contexto.usuarioId,
    });
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'ACCION_TS_REGISTRADA',
      entidad: 'Expediente',
      entidadId: expedienteId,
      detalles: { accionId: accion.id },
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });
    return accion;
  }

  private async exigirExpediente(expedienteId: string): Promise<void> {
    if (!(await this.accionesRepository.existeExpediente(expedienteId))) {
      throw new NotFoundException('Expediente no encontrado');
    }
  }
}
