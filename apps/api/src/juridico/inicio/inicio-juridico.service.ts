import { Inject, Injectable } from '@nestjs/common';
import {
  FILAS_AGENDA_INICIO,
  fechaCalendarioGT,
  finDiaGT,
  type AudienciasInicio,
  type InicioJuridicoDto,
} from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import { AGENDA_AUDIENCIAS_REPOSITORY } from '../interfaces/agenda-audiencias-repository.interface';
import type { IAgendaAudienciasRepository } from '../interfaces/agenda-audiencias-repository.interface';
import { INICIO_REPOSITORY } from '../interfaces/inicio-repository.interface';
import type { IInicioRepository } from '../interfaces/inicio-repository.interface';

/**
 * El Inicio es de vista rápida y cabe en una pantalla: cifras del área y la agenda corta. Las
 * listas de trabajo (referencias, procesos sin movimiento, resultados) viven en sus secciones.
 */
@Injectable()
export class InicioJuridicoService {
  constructor(
    @Inject(INICIO_REPOSITORY)
    private readonly inicioRepository: IInicioRepository,
    @Inject(AGENDA_AUDIENCIAS_REPOSITORY)
    private readonly agendaRepository: IAgendaAudienciasRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  /**
   * Sin auditoría de lectura, igual que la bandeja y la lista de procesos: son listados de
   * trabajo, no la consulta de un expediente en particular.
   */
  async obtener(): Promise<InicioJuridicoDto> {
    const ahora = this.reloj.ahora();
    const hoy = fechaCalendarioGT(ahora);
    const anio = Number(hoy.slice(0, 4));
    const [indicadores, enTramitePorTipo, audiencias] = await Promise.all([
      this.inicioRepository.indicadores(anio),
      this.inicioRepository.enTramitePorTipo(),
      this.audiencias(ahora, hoy),
    ]);

    return {
      anio,
      cargaActual: indicadores.cargaActual,
      movimientoAnio: indicadores.movimientoAnio,
      enTramitePorTipo,
      audiencias,
    };
  }

  /**
   * Las mismas vistas que la sección Audiencias: lo que queda de hoy y de los próximos días
   * ("Próximas") y lo que ya pasó sin resultado ("Pendientes"). Todo el área, no solo lo propio.
   */
  private async audiencias(
    ahora: Date,
    hoy: string,
  ): Promise<AudienciasInicio> {
    // De las de hoy y de las pendientes solo hace falta el total: se pide una fila.
    const [agenda, restantesHoy, pendientesResultado] = await Promise.all([
      this.agendaRepository.listar({
        vista: 'proximas',
        page: 1,
        pageSize: FILAS_AGENDA_INICIO,
        ahora,
      }),
      this.agendaRepository.listar({
        vista: 'proximas',
        hasta: finDiaGT(hoy),
        page: 1,
        pageSize: 1,
        ahora,
      }),
      this.agendaRepository.listar({
        vista: 'pendientes',
        page: 1,
        pageSize: 1,
        ahora,
      }),
    ]);
    return {
      agenda,
      restantesHoy: restantesHoy.total,
      pendientesResultado: pendientesResultado.total,
    };
  }
}
