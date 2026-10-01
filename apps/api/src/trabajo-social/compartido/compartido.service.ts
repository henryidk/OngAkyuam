import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AREAS_ATENCION, type CompartidoArea } from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { EstrategiasCompartido } from './estrategias-compartido';
import { COMPARTIDO_REPOSITORY } from './interfaces/compartido-repository.interface';
import type { ICompartidoRepository } from './interfaces/compartido-repository.interface';

/** "Compartido con Trabajo Social por otras áreas": solo lectura, una entrada por área. */
@Injectable()
export class CompartidoService {
  constructor(
    @Inject(COMPARTIDO_REPOSITORY)
    private readonly compartidoRepository: ICompartidoRepository,
    private readonly estrategias: EstrategiasCompartido,
    private readonly auditService: AuditService,
  ) {}

  async obtener(
    expedienteId: string,
    contexto: ContextoAuditoria,
  ): Promise<CompartidoArea[]> {
    const referidas =
      await this.compartidoRepository.areasReferidas(expedienteId);
    if (!referidas) {
      throw new NotFoundException('Expediente no encontrado');
    }

    const compartido = await Promise.all(
      AREAS_ATENCION.map(async (area): Promise<CompartidoArea> => {
        const referida = referidas.includes(area);
        // Un área no referida no tiene nada que publicar: ni se consulta.
        const lineas = referida
          ? await this.estrategias.para(area).obtener(expedienteId)
          : [];
        return { area, referida, lineas };
      }),
    );

    // Lectura de datos de otras áreas: se audita igual que la consulta del expediente.
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'COMPARTIDO_AREAS_CONSULTADO',
      entidad: 'Expediente',
      entidadId: expedienteId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return compartido;
  }
}
