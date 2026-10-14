import { Inject, Injectable } from '@nestjs/common';
import type {
  VisibilidadAtencionMedicaDto,
  VisibilidadAtencionMedicaInput,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { traducirErrorMedica } from '../compartido/errores-http';
import { MENSAJE_ATENCION_CAMBIO } from '../compartido/mensajes';
import {
  ATENCIONES_MEDICAS_REPOSITORY,
  type IAtencionesMedicasRepository,
} from '../interfaces/atenciones-medicas-repository.interface';

/**
 * Lo que Medicina comparte con Jurídico (fechas y constancias) y Psicología (fechas). Se puede
 * cambiar también después del alta: compartir o dejar de compartir el historial no lo modifica.
 */
@Injectable()
export class VisibilidadService {
  constructor(
    @Inject(ATENCIONES_MEDICAS_REPOSITORY)
    private readonly atencionesRepository: IAtencionesMedicasRepository,
    private readonly acceso: AccesoMedicaService,
    private readonly auditService: AuditService,
  ) {}

  async actualizar(
    atencionId: string,
    datos: VisibilidadAtencionMedicaInput,
    contexto: ContextoAuditoria,
  ): Promise<VisibilidadAtencionMedicaDto> {
    const atencion = await this.acceso.exigirAtencion(atencionId);
    const resultado = await this.atencionesRepository
      .actualizarVisibilidad({
        atencionId,
        version: datos.version,
        juridico: datos.juridico,
        psicologia: datos.psicologia,
      })
      .catch((error: unknown) =>
        traducirErrorMedica(error, { version: MENSAJE_ATENCION_CAMBIO }),
      );

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'ATENCION_MEDICA_VISIBILIDAD',
        entidad: 'AtencionMedica',
        entidadId: atencionId,
        detalles: {
          expedienteId: atencion.expedienteId,
          visibleJuridico: resultado.visibleJuridico,
          visiblePsicologia: resultado.visiblePsicologia,
        },
      }),
    );
    return resultado;
  }
}
