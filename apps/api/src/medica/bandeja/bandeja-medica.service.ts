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

  /** La insignia de Consultas cuenta lo mismo que muestra "Por atender": una sola definición. */
  async contadores(): Promise<ContadoresMedicaDto> {
    const [referencias, porAtender] = await Promise.all([
      this.lectorPendientes.referenciasPendientes(),
      this.porAtender.listar(),
    ]);
    return {
      areaAtencion: referencias.length,
      consultasPorAtender: porAtender.hoy.length + porAtender.atrasadas.length,
    };
  }
}
