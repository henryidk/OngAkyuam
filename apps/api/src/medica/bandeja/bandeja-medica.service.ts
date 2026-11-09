import { Inject, Injectable } from '@nestjs/common';
import {
  LIMITE_BANDEJA_MEDICA,
  type ContadoresMedicaDto,
  type ReferenciaBandejaMedicaDto,
} from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import { corteSinVenir } from '../dominio/sin-proxima';
import { PorRegistrarService } from '../consultas/por-registrar.service';
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
    private readonly porRegistrar: PorRegistrarService,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  pendientes(): Promise<ReferenciaBandejaMedicaDto[]> {
    return this.lectorPendientes.referenciasPendientes(LIMITE_BANDEJA_MEDICA);
  }

  /**
   * La insignia de Consultas cuenta lo mismo que muestra "Por registrar": una sola definición.
   * `sinProxima` no es insignia: es el número de la tarjeta de la Agenda, calculado con la misma
   * consulta que la lista de Pacientes a la que lleva.
   */
  async contadores(): Promise<ContadoresMedicaDto> {
    const [referencias, porRegistrar, sinProxima] = await Promise.all([
      this.lectorPendientes.contarReferenciasPendientes(),
      this.porRegistrar.listar(),
      this.lectorPendientes.conteosSinProxima({
        corte: corteSinVenir(this.reloj.ahora()),
      }),
    ]);
    return {
      areaAtencion: referencias,
      consultasPorRegistrar:
        porRegistrar.hoy.length + porRegistrar.totalAtrasadas,
      sinProxima: sinProxima.TODAS,
    };
  }
}
