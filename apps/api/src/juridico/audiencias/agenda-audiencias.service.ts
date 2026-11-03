import { Inject, Injectable } from '@nestjs/common';
import {
  AUDIENCIAS_PAGE_SIZE,
  DIAS_ANTICIPACION_AVISO_AUDIENCIA,
  fechaCalendarioGT,
  finDiaGT,
  sumarDiasGT,
  inicioDiaGT,
  type AudienciaDetalleDto,
  type AudienciasPaginadas,
  type DisponibilidadAudienciasDto,
  type DisponibilidadAudienciasQuery,
  type BuscarAudienciasDatos,
  type ResumenAudienciasDatos,
  type ResumenAudienciasDto,
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
    query: BuscarAudienciasDatos,
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

  /**
   * Cifras de la cabecera. Solo totales (una fila por consulta), sin auditoría de lectura: igual
   * que el Inicio, no muestran ningún expediente.
   */
  async resumen(
    query: ResumenAudienciasDatos,
    usuarioId: string,
  ): Promise<ResumenAudienciasDto> {
    const ahora = this.reloj.ahora();
    const hoy = fechaCalendarioGT(ahora);
    const filtro = {
      responsableId: query.mias ? undefined : query.responsableId,
      responsableUsuarioId: query.mias ? usuarioId : undefined,
      page: 1,
      pageSize: 1,
      ahora,
    };
    const [restantesHoy, semana, pendientes] = await Promise.all([
      this.agendaRepository.listar({
        ...filtro,
        vista: 'proximas',
        hasta: finDiaGT(hoy),
      }),
      this.agendaRepository.listar({
        ...filtro,
        vista: 'proximas',
        hasta: finDiaGT(sumarDiasGT(hoy, DIAS_ANTICIPACION_AVISO_AUDIENCIA)),
      }),
      // Pendientes viene de la más antigua a la más reciente: la primera es la que más espera.
      this.agendaRepository.listar({ ...filtro, vista: 'pendientes' }),
    ]);
    return {
      hoy: restantesHoy.total,
      semana: semana.total,
      pendientes: pendientes.total,
      pendienteMasAntigua: pendientes.items[0]?.fecha ?? null,
    };
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
