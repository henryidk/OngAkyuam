import { Inject, Injectable } from '@nestjs/common';
import { fechaCalendarioGT, inicioDiaGT, sumarDiasGT } from '@akyuam/shared';
import type { PorAtenderMedicaDto } from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import { ordenarPorAtender } from '../dominio/por-atender';
import {
  LECTOR_CITAS_MEDICAS,
  type ILectorCitasMedicas,
} from '../interfaces/agenda-medica-repository.interface';

/**
 * Lista de trabajo de Consultas: las citas de hoy que siguen pendientes y las de días anteriores
 * que nunca se registraron. Solo lectura; nunca devuelve datos clínicos.
 */
@Injectable()
export class PorAtenderService {
  constructor(
    @Inject(LECTOR_CITAS_MEDICAS)
    private readonly lectorCitas: ILectorCitasMedicas,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  async listar(): Promise<PorAtenderMedicaDto> {
    const ahora = this.reloj.ahora();
    const hoy = fechaCalendarioGT(ahora);
    const desde = inicioDiaGT(hoy);
    const hasta = inicioDiaGT(sumarDiasGT(hoy, 1));
    const [citasHoy, atrasadas] = await Promise.all([
      this.lectorCitas.citasEntre(desde, hasta, ahora),
      this.lectorCitas.citasSinRegistrar(ahora, desde, hasta),
    ]);
    return { hoy: ordenarPorAtender(citasHoy), atrasadas };
  }
}
