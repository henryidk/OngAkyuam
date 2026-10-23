import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { inicioDiaGT, sumarDiasGT } from '@akyuam/shared';
import type {
  BuscarHistorialConsultasMedicaDatos,
  ConsultaMedicaDto,
  HistorialConsultasMedicaPaginaDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { interpretarBusqueda } from '../../common/busqueda-usuarias';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import {
  eventoAuditoria,
  eventoBusquedaAuditoria,
} from '../compartido/auditoria';
import { MENSAJE_SIN_ACCESO_CONSULTA } from '../compartido/mensajes';
import {
  HISTORIAL_CONSULTAS_REPOSITORY,
  type IHistorialConsultasRepository,
} from '../interfaces/historial-consultas-repository.interface';

/**
 * Historial de consultas registradas. Cada lectura deja constancia en la auditoría antes de
 * devolver nada: si la auditoría falla, la médica no recibe los datos.
 */
@Injectable()
export class HistorialConsultasService {
  constructor(
    @Inject(HISTORIAL_CONSULTAS_REPOSITORY)
    private readonly historialRepository: IHistorialConsultasRepository,
    private readonly acceso: AccesoMedicaService,
    private readonly auditService: AuditService,
  ) {}

  async buscar(
    datos: BuscarHistorialConsultasMedicaDatos,
    contexto: ContextoAuditoria,
  ): Promise<HistorialConsultasMedicaPaginaDto> {
    const pagina = await this.historialRepository.listar({
      desde: inicioDiaGT(datos.desde),
      hasta: inicioDiaGT(sumarDiasGT(datos.hasta, 1)),
      busqueda: interpretarBusqueda(datos.q),
      cursor: datos.cursor,
    });
    await this.auditService.registrar(
      eventoBusquedaAuditoria(contexto, {
        accion: 'HISTORIAL_CONSULTAS_MEDICAS_CONSULTADO',
        entidad: 'ConsultaMedica',
        detalles: {
          desde: datos.desde,
          hasta: datos.hasta,
          conBusqueda: datos.q !== undefined,
          pagina: datos.cursor ? 'siguiente' : 'primera',
          resultados: pagina.items.length,
        },
      }),
    );
    return pagina;
  }

  async detalle(
    consultaId: string,
    contexto: ContextoAuditoria,
  ): Promise<ConsultaMedicaDto> {
    const acceso = await this.acceso.exigirConsulta(consultaId);
    const consulta = await this.historialRepository.detalle(consultaId);
    if (!consulta) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CONSULTA);
    }
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'CONSULTA_MEDICA_VISTA',
        entidad: 'ConsultaMedica',
        entidadId: consultaId,
        detalles: {
          expedienteId: acceso.expedienteId,
          atencionId: acceso.atencionId,
        },
      }),
    );
    return consulta;
  }
}
