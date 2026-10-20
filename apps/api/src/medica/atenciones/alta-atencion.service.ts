import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { fechaCalendarioGT } from '@akyuam/shared';
import type {
  AltaAtencionMedicaDatos,
  AltaAtencionMedicaRegistradaDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { traducirErrorMedica } from '../compartido/errores-http';
import {
  MENSAJE_ATENCION_CAMBIO,
  MENSAJE_ATENCION_NO_ACTIVA,
} from '../compartido/mensajes';
import { RELOJ, type IReloj } from '../../common/reloj';
import {
  ATENCIONES_MEDICAS_REPOSITORY,
  type IAtencionesMedicasRepository,
} from '../interfaces/atenciones-medicas-repository.interface';

/** Alta de la atención: cierra el episodio y cancela las citas futuras en la misma transacción. */
@Injectable()
export class AltaAtencionService {
  constructor(
    @Inject(ATENCIONES_MEDICAS_REPOSITORY)
    private readonly atencionesRepository: IAtencionesMedicasRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
    private readonly acceso: AccesoMedicaService,
    private readonly auditService: AuditService,
  ) {}

  async darAlta(
    atencionId: string,
    datos: AltaAtencionMedicaDatos,
    contexto: ContextoAuditoria,
  ): Promise<AltaAtencionMedicaRegistradaDto> {
    const atencion = await this.acceso.exigirAtencion(atencionId);
    if (atencion.estado !== 'ACTIVA') {
      throw new ConflictException(MENSAJE_ATENCION_NO_ACTIVA);
    }
    const ahora = this.reloj.ahora();

    const citasCanceladas = await this.atencionesRepository
      .darAlta({
        atencionId,
        version: datos.version,
        motivo: datos.motivo,
        nota: datos.nota,
        fechaAlta: fechaCalendarioGT(ahora),
        ahora,
      })
      .catch((error: unknown) =>
        traducirErrorMedica(error, { version: MENSAJE_ATENCION_CAMBIO }),
      );

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'ATENCION_MEDICA_ALTA',
        entidad: 'AtencionMedica',
        entidadId: atencionId,
        detalles: {
          expedienteId: atencion.expedienteId,
          motivo: datos.motivo,
          citasCanceladas,
        },
      }),
    );
    return { atencionId, citasCanceladas };
  }
}
