import { Inject, Injectable } from '@nestjs/common';
import {
  DIAS_ANTICIPACION_AVISO_AUDIENCIA,
  fechaCalendarioGT,
  finDiaGT,
  MAX_AVISOS_AUDIENCIA,
  NIVELES_AVISO_AUDIENCIA,
  nivelAvisoAudiencia,
  sumarDiasGT,
  diasEntreFechasGT,
  type AvisoAudienciaDto,
  type AvisosAudienciasDto,
  type NivelAvisoAudiencia,
} from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import { AGENDA_AUDIENCIAS_REPOSITORY } from '../interfaces/agenda-audiencias-repository.interface';
import type { IAgendaAudienciasRepository } from '../interfaces/agenda-audiencias-repository.interface';

/**
 * Audiencias PROGRAMADAS que todavía no empiezan, de hoy a hoy + 7 días en Guatemala, para todo
 * el equipo de Jurídico (misma regla de acceso que la sección Audiencias). El navegador lo pide
 * cada hora y al entrar; lo que se notifica se decide aquí, en cada petición, no se guarda.
 */
@Injectable()
export class AvisosAudienciasService {
  constructor(
    @Inject(AGENDA_AUDIENCIAS_REPOSITORY)
    private readonly agendaRepository: IAgendaAudienciasRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  /** Sin auditoría de lectura, igual que el Inicio: es un listado de trabajo del área. */
  async obtener(): Promise<AvisosAudienciasDto> {
    const ahora = this.reloj.ahora();
    const hoy = fechaCalendarioGT(ahora);
    const { items, total } = await this.agendaRepository.listar({
      vista: 'proximas',
      hasta: finDiaGT(sumarDiasGT(hoy, DIAS_ANTICIPACION_AVISO_AUDIENCIA)),
      page: 1,
      pageSize: MAX_AVISOS_AUDIENCIA,
      ahora,
    });

    const conteos = Object.fromEntries(
      NIVELES_AVISO_AUDIENCIA.map((nivel) => [nivel, 0]),
    ) as Record<NivelAvisoAudiencia, number>;
    const avisos: AvisoAudienciaDto[] = [];
    for (const audiencia of items) {
      const nivel = nivelAvisoAudiencia(audiencia.fecha, hoy);
      if (nivel === null) continue;
      conteos[nivel] += 1;
      avisos.push({
        nivel,
        diasRestantes: diasEntreFechasGT(hoy, audiencia.fecha),
        // Solo lo que muestra la campana (exposición mínima).
        audiencia: {
          id: audiencia.id,
          procesoId: audiencia.procesoId,
          fecha: audiencia.fecha,
          hora: audiencia.hora,
          tipoProceso: audiencia.tipoProceso,
          descripcion: audiencia.descripcion,
          usuaria: audiencia.usuaria,
          responsable: audiencia.responsable,
        },
      });
    }
    return { hoy, avisos, conteos, total };
  }
}
