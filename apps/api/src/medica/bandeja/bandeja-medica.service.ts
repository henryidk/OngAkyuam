import { Inject, Injectable } from '@nestjs/common';
import type {
  ContadoresMedicaDto,
  ReferenciaBandejaMedicaDto,
} from '@akyuam/shared';
import { PorAtenderService } from '../consultas/por-atender.service';
import {
  LECTOR_PENDIENTES_MEDICA,
  type ILectorPendientesMedica,
} from '../interfaces/agenda-medica-repository.interface';

/** Área de atención: las referencias de Trabajo Social que esperan primera consulta. */
@Injectable()
export class BandejaMedicaService {
  constructor(
    @Inject(LECTOR_PENDIENTES_MEDICA)
    private readonly lectorPendientes: ILectorPendientesMedica,
    private readonly porAtender: PorAtenderService,
  ) {}

  pendientes(): Promise<ReferenciaBandejaMedicaDto[]> {
    return this.lectorPendientes.referenciasPendientes();
  }

  /**
   * Cada insignia cuenta lo mismo que muestra su pantalla ("Por atender" en Consultas, "Sin
   * próxima consulta" en la Agenda): una sola definición.
   */
  async contadores(): Promise<ContadoresMedicaDto> {
    const [referencias, porAtender, sinProxima] = await Promise.all([
      this.lectorPendientes.referenciasPendientes(),
      this.porAtender.listar(),
      this.lectorPendientes.sinProxima(),
    ]);
    return {
      areaAtencion: referencias.length,
      consultasPorAtender: porAtender.hoy.length + porAtender.atrasadas.length,
      agendaSinProxima: sinProxima.length,
    };
  }
}
