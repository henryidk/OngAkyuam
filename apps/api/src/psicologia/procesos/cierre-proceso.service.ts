import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  CerrarProcesoPsicologiaInput,
  ProcesoPsicologiaCerradoDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { eventoAuditoria } from '../compartido/auditoria';
import {
  MENSAJE_CONFLICTO_VERSION,
  MENSAJE_PROCESO_CERRADO,
} from '../compartido/mensajes';
import { estaCerrado } from '../dominio/etapa-proceso';
import { PROCESOS_PSICOLOGIA_REPOSITORY } from '../interfaces/procesos-psicologia-repository.interface';
import type { IProcesosPsicologiaRepository } from '../interfaces/procesos-psicologia-repository.interface';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

@Injectable()
export class CierreProcesoService {
  constructor(
    @Inject(PROCESOS_PSICOLOGIA_REPOSITORY)
    private readonly procesosRepository: IProcesosPsicologiaRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Cierra el proceso y cancela sus citas pendientes a futuro. Es definitivo: un proceso
   * cerrado no se reabre; si la usuaria regresa, se abre uno nuevo.
   */
  async cerrar(
    procesoId: string,
    datos: CerrarProcesoPsicologiaInput,
    contexto: ContextoAuditoria,
  ): Promise<ProcesoPsicologiaCerradoDto> {
    const proceso = await this.acceso.exigirAccesoProceso(
      procesoId,
      contexto.usuarioId,
    );
    if (estaCerrado(proceso.etapa)) {
      throw new ConflictException(MENSAJE_PROCESO_CERRADO);
    }
    if (proceso.version !== datos.version) {
      throw new ConflictException(MENSAJE_CONFLICTO_VERSION);
    }

    const cerrado = await this.procesosRepository.cerrar({
      procesoId,
      version: datos.version,
      motivo: datos.motivo,
      resumen: datos.resumen === '' ? null : datos.resumen,
      cerradoPorId: contexto.usuarioId,
    });
    if (!cerrado) {
      throw new ConflictException(MENSAJE_CONFLICTO_VERSION);
    }

    // El motivo es un valor de catálogo; el resumen es texto clínico y no va a la auditoría.
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'PROCESO_PSICOLOGICO_CERRADO',
        entidad: 'AtencionPsicologica',
        entidadId: procesoId,
        detalles: {
          expedienteId: proceso.expedienteId,
          motivo: datos.motivo,
          citasCanceladas: cerrado.citasCanceladas,
        },
      }),
    );

    return {
      id: procesoId,
      version: cerrado.version,
      citasCanceladas: cerrado.citasCanceladas,
    };
  }
}
