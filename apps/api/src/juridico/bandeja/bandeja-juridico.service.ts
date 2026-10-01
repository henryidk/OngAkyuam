import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  DevolverReferenciaInput,
  ReferenciaBandejaDto,
  VistaBandejaJuridico,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import { MENSAJE_SIN_ACCESO_REFERENCIA } from '../compartido/mensajes';
import { REFERENCIAS_REPOSITORY } from '../interfaces/referencias-repository.interface';
import type { IReferenciasRepository } from '../interfaces/referencias-repository.interface';

@Injectable()
export class BandejaJuridicoService {
  constructor(
    @Inject(REFERENCIAS_REPOSITORY)
    private readonly referenciasRepository: IReferenciasRepository,
    private readonly auditService: AuditService,
  ) {}

  listar(vista: VistaBandejaJuridico): Promise<ReferenciaBandejaDto[]> {
    return this.referenciasRepository.listar(vista);
  }

  async devolver(
    referidoId: string,
    datos: DevolverReferenciaInput,
    contexto: ContextoAuditoria,
  ): Promise<void> {
    const devuelta = await this.referenciasRepository.devolver({
      referidoId,
      motivo: datos.motivo,
      devueltoPorId: contexto.usuarioId,
    });
    if (!devuelta) {
      // Mismo 403 si no existe, si es de otra área o si ya no está pendiente.
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_REFERENCIA);
    }

    // Sobre el expediente (no sobre el referido) para que aparezca en su línea de tiempo,
    // que es donde Trabajo Social ve lo que hicieron las áreas. El motivo no va aquí.
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'REFERENCIA_JURIDICO_DEVUELTA',
        entidad: 'Expediente',
        entidadId: devuelta.expedienteId,
        detalles: { referidoId, area: 'JURIDICO' },
      }),
    );
  }
}
