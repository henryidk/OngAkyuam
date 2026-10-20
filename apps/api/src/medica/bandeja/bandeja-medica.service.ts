import { Inject, Injectable } from '@nestjs/common';
import { fechaCalendarioGT, inicioDiaGT, sumarDiasGT } from '@akyuam/shared';
import type {
  ContadoresMedicaDto,
  ReferenciaBandejaMedicaDto,
} from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import { derivarEstadoCita } from '../dominio/estado-cita';
import {
  AGENDA_MEDICA_REPOSITORY,
  type IAgendaMedicaRepository,
} from '../interfaces/agenda-medica-repository.interface';

/** Estados que todavía piden algo de la médica hoy. */
const POR_ATENDER = new Set(['PROGRAMADA', 'EN_CURSO', 'SIN_REGISTRAR']);

/** Área de atención: las referencias de Trabajo Social que esperan primera consulta. */
@Injectable()
export class BandejaMedicaService {
  constructor(
    @Inject(AGENDA_MEDICA_REPOSITORY)
    private readonly agendaRepository: IAgendaMedicaRepository,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  pendientes(): Promise<ReferenciaBandejaMedicaDto[]> {
    return this.agendaRepository.referenciasPendientes();
  }

  async contadores(): Promise<ContadoresMedicaDto> {
    const ahora = this.reloj.ahora();
    const hoy = fechaCalendarioGT(ahora);
    const [referencias, citasHoy] = await Promise.all([
      this.agendaRepository.referenciasPendientes(),
      this.agendaRepository.resumenEntre(
        inicioDiaGT(hoy),
        inicioDiaGT(sumarDiasGT(hoy, 1)),
      ),
    ]);
    return {
      areaAtencion: referencias.length,
      agendaHoy: citasHoy.filter((c) =>
        POR_ATENDER.has(derivarEstadoCita(c, ahora)),
      ).length,
    };
  }
}
