import { Inject, Injectable } from '@nestjs/common';
import {
  LIMITE_BANDEJA_MEDICA,
  type ContadoresMedicaDto,
  type ReferenciaBandejaMedicaDto,
} from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import { corteSinVenir } from '../dominio/sin-proxima';
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
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  pendientes(): Promise<ReferenciaBandejaMedicaDto[]> {
    return this.lectorPendientes.referenciasPendientes(LIMITE_BANDEJA_MEDICA);
  }

  /**
   * La insignia de Consultas cuenta lo mismo que muestra "Por atender": una sola definición.
   * `sinProxima` no es insignia: es el número de la tarjeta de la Agenda, calculado con la misma
   * consulta que la lista de Pacientes a la que lleva.
   */
  async contadores(): Promise<ContadoresMedicaDto> {
    const [referencias, porAtender, sinProxima] = await Promise.all([
      this.lectorPendientes.contarReferenciasPendientes(),
      this.porAtender.listar(),
      this.lectorPendientes.conteosSinProxima({
        corte: corteSinVenir(this.reloj.ahora()),
      }),
    ]);
    return {
      areaAtencion: referencias,
      consultasPorAtender: porAtender.hoy.length + porAtender.totalAtrasadas,
      sinProxima: sinProxima.TODAS,
    };
  }
}
