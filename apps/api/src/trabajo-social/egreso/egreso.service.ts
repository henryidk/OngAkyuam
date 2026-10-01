import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EgresoRegistrado, RegistrarEgresoInput } from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { EGRESO_REPOSITORY } from './interfaces/egreso-repository.interface';
import type { IEgresoRepository } from './interfaces/egreso-repository.interface';

const MENSAJE_NO_ES_INTERNA =
  'Solo se registra el egreso de un caso con ingreso al albergue';
const MENSAJE_EGRESO_YA_REGISTRADO = 'El egreso de este caso ya fue registrado';

// TODO(ONG): confirmar si el egreso lo registra Trabajo Social o la encargada del albergue.
@Injectable()
export class EgresoService {
  constructor(
    @Inject(EGRESO_REPOSITORY)
    private readonly egresoRepository: IEgresoRepository,
    private readonly auditService: AuditService,
  ) {}

  async registrar(
    expedienteId: string,
    datos: RegistrarEgresoInput,
    contexto: ContextoAuditoria,
  ): Promise<EgresoRegistrado> {
    const expediente =
      await this.egresoRepository.buscarExpediente(expedienteId);
    if (!expediente) {
      throw new NotFoundException('Expediente no encontrado');
    }
    if (expediente.tipoRegistro !== 'INTERNA') {
      throw new ConflictException(MENSAJE_NO_ES_INTERNA);
    }
    if (expediente.fechaEgresoAlbergue !== null) {
      throw new ConflictException(MENSAJE_EGRESO_YA_REGISTRADO);
    }
    // Strings "YYYY-MM-DD": ordenan igual que las fechas, sin pasar por `Date`.
    if (
      expediente.fechaIngresoAlbergue !== null &&
      datos.fechaEgreso < expediente.fechaIngresoAlbergue
    ) {
      throw new BadRequestException(
        'La fecha de egreso no puede ser anterior al ingreso al albergue',
      );
    }

    const registrado = await this.egresoRepository.registrarEgreso(
      expedienteId,
      datos.fechaEgreso,
    );
    if (!registrado) {
      throw new ConflictException(MENSAJE_EGRESO_YA_REGISTRADO);
    }

    // Sin `detalles`: el aviso a la bandeja sale de esta auditoría (ver AvisosBandejaListener).
    await this.auditService.registrar({
      usuarioId: contexto.usuarioId,
      username: contexto.username,
      accion: 'EGRESO_ALBERGUE_REGISTRADO',
      entidad: 'Expediente',
      entidadId: expedienteId,
      ipAddress: contexto.ipAddress,
      userAgent: contexto.userAgent,
    });

    return { expedienteId, fechaEgreso: datos.fechaEgreso };
  }
}
