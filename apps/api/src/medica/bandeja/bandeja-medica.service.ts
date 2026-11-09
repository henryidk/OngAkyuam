import { Inject, Injectable } from '@nestjs/common';
import {
  LIMITE_BANDEJA_MEDICA,
  type ContadoresMedicaDto,
  type ReferenciaBandejaMedicaDto,
} from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import type { PersonalQueReserva } from '../../common/reservas-caso';
import { AccesoMedicaService } from '../compartido/acceso-medica.service';
import { ReservasMedica } from '../compartido/reservas';
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
    private readonly acceso: AccesoMedicaService,
    private readonly reservas: ReservasMedica,
  ) {}

  /** Cada tarjeta dice si alguien le está agendando la primera consulta en este momento. */
  async pendientes(usuarioId: string): Promise<ReferenciaBandejaMedicaDto[]> {
    const referencias = await this.lectorPendientes.referenciasPendientes(
      LIMITE_BANDEJA_MEDICA,
    );
    const reservas = await this.reservas.vigentes(
      referencias.map((referencia) => referencia.referidoId),
      usuarioId,
    );
    return referencias.map((referencia, i) => ({
      ...referencia,
      reserva: reservas[i],
    }));
  }

  /**
   * Reserva o renueva la referencia mientras se agenda su primera consulta. Que ya esté atendida
   * lo decide la transacción que crea la cita: reservar no cambia nada del caso.
   */
  async reservar(
    referidoId: string,
    personal: PersonalQueReserva,
  ): Promise<void> {
    await this.acceso.exigirReferencia(referidoId);
    await this.reservas.reservar(referidoId, personal, 'AGENDANDO');
  }

  /** Suelta la reserva propia; si es de otra persona o ya venció, no pasa nada. */
  liberar(referidoId: string, usuarioId: string): Promise<void> {
    return this.reservas.liberar(referidoId, usuarioId);
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
