import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  inicioDiaGT,
  PAGINA_HISTORIAL_CONSULTAS_PSICOLOGIA,
  sumarDiasGT,
} from '@akyuam/shared';
import type {
  BuscarHistorialConsultasPsicologiaDatos,
  DetalleConsultaPsicologiaDto,
  HistorialConsultasPsicologiaPaginado,
  SesionPorRegistrarDto,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import {
  eventoAuditoria,
  eventoBusquedaAuditoria,
} from '../compartido/auditoria';
import { MENSAJE_SIN_ACCESO_CITA } from '../compartido/mensajes';
import {
  CONSULTAS_SESIONES_REPOSITORY,
  type IConsultasSesionesRepository,
} from '../interfaces/consultas-sesiones-repository.interface';
import { palabrasDeBusqueda } from '../procesos/consultas-procesos.service';
import { AccesoPsicologiaService } from '../services/acceso-psicologia.service';

/**
 * Sección Consultas: lo mío por registrar y el historial de sesiones del área. El historial y
 * cada sesión abierta quedan en la auditoría antes de devolver nada: si la auditoría falla, no
 * sale ningún dato.
 */
@Injectable()
export class ConsultasPsicologiaService {
  constructor(
    @Inject(CONSULTAS_SESIONES_REPOSITORY)
    private readonly sesionesRepository: IConsultasSesionesRepository,
    private readonly acceso: AccesoPsicologiaService,
    private readonly auditService: AuditService,
  ) {}

  /** Solo lo que quien consulta puede registrar: lo filtra la propia consulta. */
  porRegistrar(psicologaId: string): Promise<SesionPorRegistrarDto[]> {
    return this.sesionesRepository.porRegistrar(psicologaId, new Date());
  }

  async historial(
    datos: BuscarHistorialConsultasPsicologiaDatos,
    contexto: ContextoAuditoria,
  ): Promise<HistorialConsultasPsicologiaPaginado> {
    const pagina = await this.sesionesRepository.historial({
      psicologaId: contexto.usuarioId,
      alcance: datos.de,
      desde: inicioDiaGT(datos.desde),
      hasta: inicioDiaGT(sumarDiasGT(datos.hasta, 1)),
      palabras: palabrasDeBusqueda(datos.q),
      clinica: datos.clinica,
      estado: datos.estado,
      cursor: datos.cursor,
      limite: PAGINA_HISTORIAL_CONSULTAS_PSICOLOGIA,
    });

    await this.auditService.registrar(
      eventoBusquedaAuditoria(contexto, {
        accion: 'HISTORIAL_SESIONES_PSICOLOGIA_CONSULTADO',
        entidad: 'CitaPsicologica',
        detalles: {
          desde: datos.desde,
          hasta: datos.hasta,
          de: datos.de,
          clinica: datos.clinica ?? null,
          estado: datos.estado ?? null,
          conBusqueda: datos.q !== undefined,
          pagina: datos.cursor ? 'siguiente' : 'primera',
          resultados: pagina.items.length,
        },
      }),
    );

    return pagina;
  }

  /** Las notas completas de una sesión: las lee toda el área, y cada apertura se audita. */
  async detalle(
    citaId: string,
    contexto: ContextoAuditoria,
  ): Promise<DetalleConsultaPsicologiaDto> {
    const lectura = await this.acceso.exigirLecturaCita(
      citaId,
      contexto.usuarioId,
    );
    // Una cita aún sin registrar no tiene nada que leer aquí: el mismo 403.
    const sesion = await this.sesionesRepository.detalle(citaId);
    if (!sesion) {
      throw new ForbiddenException(MENSAJE_SIN_ACCESO_CITA);
    }

    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'SESION_PSICOLOGICA_VISTA',
        entidad: 'CitaPsicologica',
        entidadId: citaId,
        detalles: {
          expedienteId: lectura.expedienteId,
          procesoId: lectura.atencionId,
          deColega: !lectura.propia,
        },
      }),
    );

    return sesion;
  }
}
