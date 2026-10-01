import { Inject, Injectable } from '@nestjs/common';
import type {
  EntradaBitacoraDto,
  RegistrarActuacionInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { BITACORA_REPOSITORY } from '../interfaces/bitacora-repository.interface';
import type { IBitacoraRepository } from '../interfaces/bitacora-repository.interface';

@Injectable()
export class BitacoraService {
  constructor(
    @Inject(BITACORA_REPOSITORY)
    private readonly bitacoraRepository: IBitacoraRepository,
    private readonly acceso: AccesoJuridicoService,
    private readonly auditService: AuditService,
  ) {}

  async registrarActuacion(
    procesoId: string,
    datos: RegistrarActuacionInput,
    contexto: ContextoAuditoria,
  ): Promise<EntradaBitacoraDto> {
    await this.acceso.exigirProceso(procesoId);

    const entrada = await this.bitacoraRepository.registrar({
      procesoId,
      tipo: datos.tipo,
      contenido: datos.contenido,
      registradoPorId: contexto.usuarioId,
    });

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'ACTUACION_PROCESO_REGISTRADA',
        entidad: 'NotaAvanceProceso',
        entidadId: entrada.id,
        detalles: { procesoId, tipo: datos.tipo },
      }),
    );

    return entrada;
  }
}
