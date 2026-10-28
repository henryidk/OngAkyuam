import { Inject, Injectable } from '@nestjs/common';
import { fechaCalendarioGT, inicioDiaGT, sumarDiasGT } from '@akyuam/shared';
import type {
  ContadoresMedicaDto,
  ReferenciaBandejaMedicaDto,
} from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import { derivarEstadoCita } from '../dominio/estado-cita';
import { esPorAtender } from '../dominio/por-atender';
import {
  LECTOR_CITAS_MEDICAS,
  LECTOR_PENDIENTES_MEDICA,
  type ILectorCitasMedicas,
  type ILectorPendientesMedica,
} from '../interfaces/agenda-medica-repository.interface';

/** Área de atención: las referencias de Trabajo Social que esperan primera consulta. */
@Injectable()
export class BandejaMedicaService {
  constructor(
    @Inject(LECTOR_PENDIENTES_MEDICA)
    private readonly lectorPendientes: ILectorPendientesMedica,
    @Inject(LECTOR_CITAS_MEDICAS)
    private readonly lectorCitas: ILectorCitasMedicas,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  pendientes(): Promise<ReferenciaBandejaMedicaDto[]> {
    return this.lectorPendientes.referenciasPendientes();
  }

  async contadores(): Promise<ContadoresMedicaDto> {
    const ahora = this.reloj.ahora();
    const hoy = fechaCalendarioGT(ahora);
    const [referencias, citasHoy] = await Promise.all([
      this.lectorPendientes.referenciasPendientes(),
      this.lectorCitas.resumenEntre(
        inicioDiaGT(hoy),
        inicioDiaGT(sumarDiasGT(hoy, 1)),
      ),
    ]);
    return {
      areaAtencion: referencias.length,
      agendaHoy: citasHoy.filter((c) =>
        esPorAtender(derivarEstadoCita(c, ahora)),
      ).length,
    };
  }
}
