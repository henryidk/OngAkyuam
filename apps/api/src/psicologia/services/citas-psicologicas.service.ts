import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { CitaPsicologicaDetalle } from '@akyuam/shared';
import { CITAS_PSICOLOGICAS_REPOSITORY } from '../interfaces/citas-psicologicas-repository.interface';
import type { ICitasPsicologicasRepository } from '../interfaces/citas-psicologicas-repository.interface';
import { AccesoPsicologiaService } from './acceso-psicologia.service';

@Injectable()
export class CitasPsicologicasService {
  constructor(
    private readonly acceso: AccesoPsicologiaService,
    @Inject(CITAS_PSICOLOGICAS_REPOSITORY)
    private readonly citasRepository: ICitasPsicologicasRepository,
  ) {}

  /** Permalink de una cita puntual — `GET /psicologia/citas/:id`. */
  async obtenerDetalleCita(
    citaId: string,
    psicologaId: string,
  ): Promise<CitaPsicologicaDetalle> {
    await this.acceso.exigirAccesoCita(citaId, psicologaId);

    const cita = await this.citasRepository.obtenerDetalle(citaId);
    if (!cita) {
      throw new NotFoundException('Cita no encontrada');
    }
    return cita;
  }
}
