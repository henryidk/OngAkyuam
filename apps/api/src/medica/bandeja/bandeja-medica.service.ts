import { Inject, Injectable } from '@nestjs/common';
import {
  dejoDeVenirMedica,
  hoyGT,
  type ContadoresMedicaDto,
  type ReferenciaBandejaMedicaDto,
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
   * La insignia de Consultas cuenta lo mismo que muestra "Por atender": una sola definición.
   * La de la Agenda cuenta solo las pacientes sin próxima consulta recientes (faltó o se atendió
   * hace menos de 2 meses): son las que aún se recuperan con una llamada y el número baja en
   * cuanto se agendan. Las que dejaron de venir siguen en el panel, pero no suman: un número que
   * casi nunca baja se deja de mirar.
   */
  async contadores(): Promise<ContadoresMedicaDto> {
    const [referencias, porAtender, sinProxima] = await Promise.all([
      this.lectorPendientes.referenciasPendientes(),
      this.porAtender.listar(),
      this.lectorPendientes.sinProxima(),
    ]);
    const hoy = hoyGT();
    return {
      areaAtencion: referencias.length,
      consultasPorAtender: porAtender.hoy.length + porAtender.atrasadas.length,
      agendaSinProxima: sinProxima.filter(
        (paciente) => !dejoDeVenirMedica(paciente.desde, hoy),
      ).length,
    };
  }
}
