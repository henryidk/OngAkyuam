import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIENCIAS_PAGE_SIZE,
  finDiaGT,
  inicioDiaGT,
  type AudienciaDetalleDto,
  type AudienciasPaginadas,
  type DisponibilidadAudienciasDto,
  type DisponibilidadAudienciasQuery,
  type ListarAudienciasQuery,
} from '@akyuam/shared';
import { AuditService } from '../../auth/services/audit.service';
import { RELOJ, type IReloj } from '../../common/reloj';
import type { ContextoAuditoria } from '../../common/types/contexto-auditoria';
import { AccesoJuridicoService } from '../compartido/acceso-juridico.service';
import { eventoAuditoria } from '../compartido/auditoria';
import { AGENDA_AUDIENCIAS_REPOSITORY } from '../interfaces/agenda-audiencias-repository.interface';
import type { IAgendaAudienciasRepository } from '../interfaces/agenda-audiencias-repository.interface';

/** Lecturas de la agenda: sección Audiencias, disponibilidad de la abogada y pestaña del proceso. */
@Injectable()
export class AgendaAudienciasService {
  constructor(
    @Inject(AGENDA_AUDIENCIAS_REPOSITORY)
    private readonly agendaRepository: IAgendaAudienciasRepository,
    private readonly acceso: AccesoJuridicoService,
    @Inject(RELOJ) private readonly reloj: IReloj,
    private readonly auditService: AuditService,
  ) {}

  async listar(
    query: ListarAudienciasQuery,
    usuarioId: string,
  ): Promise<AudienciasPaginadas> {
    const { items, total } = await this.agendaRepository.listar({
      vista: query.vista,
      q: query.q,
      responsableId: query.responsableId,
      responsableUsuarioId: query.mias ? usuarioId : undefined,
      desde: query.desde ? inicioDiaGT(query.desde) : undefined,
      hasta: query.hasta ? finDiaGT(query.hasta) : undefined,
      estado: query.estado,
      page: query.page,
      pageSize: AUDIENCIAS_PAGE_SIZE,
      ahora: this.reloj.ahora(),
    });
    return { items, total, page: query.page, pageSize: AUDIENCIAS_PAGE_SIZE };
  }

  async disponibilidad(
    query: DisponibilidadAudienciasQuery,
  ): Promise<DisponibilidadAudienciasDto> {
    const audiencias = await this.agendaRepository.listarOcupadas(
      query.responsableId,
      inicioDiaGT(query.fecha),
      finDiaGT(query.fecha),
    );
    return {
      fecha: query.fecha,
      responsableId: query.responsableId,
      audiencias,
    };
  }

  async listarPorProceso(
    procesoId: string,
    contexto: ContextoAuditoria,
  ): Promise<AudienciaDetalleDto[]> {
    await this.acceso.exigirProceso(procesoId);
    const audiencias = await this.agendaRepository.listarPorProceso(
      procesoId,
      this.reloj.ahora(),
    );
    await this.auditService.registrar(
      eventoAuditoria(contexto, {
        accion: 'AUDIENCIAS_CONSULTADAS',
        entidad: 'ProcesoJuridico',
        entidadId: procesoId,
      }),
    );
    return audiencias;
  }
}
