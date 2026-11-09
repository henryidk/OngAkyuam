import { Inject, Injectable } from '@nestjs/common';
import { fechaCalendarioGT, inicioDiaGT, sumarDiasGT } from '@akyuam/shared';
import {
  LIMITE_ATRASADAS_MEDICA,
  type PorRegistrarMedicaDto,
} from '@akyuam/shared';
import { RELOJ, type IReloj } from '../../common/reloj';
import { ordenarPorRegistrar } from '../dominio/por-registrar';
import {
  LECTOR_CITAS_MEDICAS,
  type ILectorCitasMedicas,
} from '../interfaces/agenda-medica-repository.interface';

/**
 * Consultas › Por registrar: las citas de hoy que ya empezaron sin registro y las de días
 * anteriores que nunca se registraron (de la más reciente a la más antigua). Las de hoy que
 * todavía no empiezan viven en la Agenda. Solo lectura; nunca devuelve datos clínicos.
 */
@Injectable()
export class PorRegistrarService {
  constructor(
    @Inject(LECTOR_CITAS_MEDICAS)
    private readonly lectorCitas: ILectorCitasMedicas,
    @Inject(RELOJ) private readonly reloj: IReloj,
  ) {}

  async listar(): Promise<PorRegistrarMedicaDto> {
    const ahora = this.reloj.ahora();
    const hoy = fechaCalendarioGT(ahora);
    const desde = inicioDiaGT(hoy);
    const hasta = inicioDiaGT(sumarDiasGT(hoy, 1));
    const [citasHoy, atrasadas, totalAtrasadas] = await Promise.all([
      this.lectorCitas.citasEntre(desde, hasta, ahora),
      this.lectorCitas.citasSinRegistrar(
        ahora,
        desde,
        hasta,
        LIMITE_ATRASADAS_MEDICA,
      ),
      this.lectorCitas.contarCitasSinRegistrar(ahora, desde, hasta),
    ]);
    return {
      hoy: ordenarPorRegistrar(citasHoy, ahora),
      atrasadas,
      // Nunca menos que las que se ven (ver `condicionSinRegistrar`).
      totalAtrasadas: Math.max(totalAtrasadas, atrasadas.length),
    };
  }
}
