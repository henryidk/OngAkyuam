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

  /** Permalink de una cita puntual — `GET /psicologia/citas/:id`. Lo puede leer toda el área. */
  async obtenerDetalleCita(
    citaId: string,
    psicologaId: string,
  ): Promise<CitaPsicologicaDetalle> {
    await this.acceso.exigirLecturaCita(citaId, psicologaId);

    const cita = await this.citasRepository.obtenerDetalle(citaId);
    if (!cita) {
      throw new NotFoundException('Cita no encontrada');
    }
    // Propone la clínica ya anotada o, si no hay, la última que usó quien va a registrar.
    const clinicaSugerida =
      cita.clinica ??
      (await this.citasRepository.buscarUltimaClinica(psicologaId));
    return { ...cita, clinicaSugerida };
  }
}
